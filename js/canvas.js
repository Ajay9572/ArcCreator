/* ArcCanvas: interactive SVG diagram engine — drag, connect, pan/zoom,
   select, undo/redo. No external dependencies. */

const SVG_NS = 'http://www.w3.org/2000/svg';

class ArcCanvas {
  constructor(svgEl) {
    this.svg = svgEl;
    this.NODE_W = 180;
    this.NODE_H = 120;
    this.nodes = [];
    this.edges = [];
    this.nodeEls = new Map();
    this.edgeEls = new Map();
    this.groupEls = new Map();
    this.groupOverrides = new Map(); // groupName -> manually resized {x,y,w,h}
    this.selected = null;
    this.view = { scale: 1, tx: 0, ty: 0 };
    this.drag = null;
    this.pointers = new Map(); // active pointerId -> {x,y} in svg space, for pinch gestures
    this.history = [];
    this.redoStack = [];
    this._idSeq = 0;
    this.onChange = () => {};
    this.onSelect = () => {};
    this.onViewChange = () => {};
    this._buildStatic();
    this._bindEvents();
    this._observeResize();
  }

  /* ---------- setup ---------- */

  _buildStatic() {
    this.svg.innerHTML = '';
    const defs = document.createElementNS(SVG_NS, 'defs');

    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8.5');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '9');
    marker.setAttribute('markerHeight', '9');
    marker.setAttribute('orient', 'auto-start-reverse');
    const arrowPath = document.createElementNS(SVG_NS, 'path');
    arrowPath.setAttribute('d', 'M0,0 L10,5 L0,10 z');
    arrowPath.setAttribute('class', 'arrowhead-fill');
    marker.appendChild(arrowPath);
    defs.appendChild(marker);

    for (const type in ICON_DEFS) {
      const symbol = document.createElementNS(SVG_NS, 'symbol');
      symbol.setAttribute('id', 'icon-' + type);
      symbol.setAttribute('viewBox', '0 0 24 24');
      symbol.innerHTML = ICON_DEFS[type];
      defs.appendChild(symbol);
    }
    this.svg.appendChild(defs);

    this.bgRect = document.createElementNS(SVG_NS, 'rect');
    this.bgRect.setAttribute('class', 'canvas-bg');
    this.bgRect.setAttribute('x', '-100000');
    this.bgRect.setAttribute('y', '-100000');
    this.bgRect.setAttribute('width', '200000');
    this.bgRect.setAttribute('height', '200000');
    this.svg.appendChild(this.bgRect);

    this.viewport = document.createElementNS(SVG_NS, 'g');
    this.viewport.setAttribute('class', 'viewport');
    this.svg.appendChild(this.viewport);

    this.groupLayer = document.createElementNS(SVG_NS, 'g');
    this.groupLayer.setAttribute('class', 'group-layer');
    this.edgeLayer = document.createElementNS(SVG_NS, 'g');
    this.edgeLayer.setAttribute('class', 'edge-layer');
    this.nodeLayer = document.createElementNS(SVG_NS, 'g');
    this.nodeLayer.setAttribute('class', 'node-layer');
    this.labelLayer = document.createElementNS(SVG_NS, 'g');
    this.labelLayer.setAttribute('class', 'label-layer');
    this.viewport.appendChild(this.groupLayer);
    this.viewport.appendChild(this.edgeLayer);
    this.viewport.appendChild(this.nodeLayer);
    this.viewport.appendChild(this.labelLayer);

    this.tempLine = document.createElementNS(SVG_NS, 'path');
    this.tempLine.setAttribute('class', 'temp-edge');
    this.tempLine.style.display = 'none';
    this.viewport.appendChild(this.tempLine);
  }

  _observeResize() {
    const update = () => {
      const r = this.svg.getBoundingClientRect();
      this.width = Math.max(1, r.width);
      this.height = Math.max(1, r.height);
      this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    };
    update();
    if (window.ResizeObserver) new ResizeObserver(update).observe(this.svg);
    else window.addEventListener('resize', update);
  }

  /* ---------- coordinate helpers ---------- */

  _svgPoint(clientX, clientY) {
    const r = this.svg.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }
  _toWorld(sx, sy) {
    return { x: (sx - this.view.tx) / this.view.scale, y: (sy - this.view.ty) / this.view.scale };
  }
  applyViewTransform() {
    this.viewport.setAttribute('transform', `translate(${this.view.tx},${this.view.ty}) scale(${this.view.scale})`);
    this.onViewChange();
  }

  /* ---------- history ---------- */

  snapshot() {
    return JSON.stringify({ nodes: this.nodes, edges: this.edges, groupOverrides: Object.fromEntries(this.groupOverrides) });
  }
  pushHistory() {
    this.history.push(this.snapshot());
    if (this.history.length > 40) this.history.shift();
    this.redoStack = [];
  }
  undo() {
    if (!this.history.length) return;
    this.redoStack.push(this.snapshot());
    const prev = JSON.parse(this.history.pop());
    this.nodes = prev.nodes; this.edges = prev.edges;
    this.groupOverrides = new Map(Object.entries(prev.groupOverrides || {}));
    this.selected = null; this.renderAll(); this.onSelect(null); this.onChange();
  }
  redo() {
    if (!this.redoStack.length) return;
    this.history.push(this.snapshot());
    const next = JSON.parse(this.redoStack.pop());
    this.nodes = next.nodes; this.edges = next.edges;
    this.groupOverrides = new Map(Object.entries(next.groupOverrides || {}));
    this.selected = null; this.renderAll(); this.onSelect(null); this.onChange();
  }

  /* ---------- data ops ---------- */

  loadGraph(graph, { merge } = {}) {
    this.pushHistory();
    if (!merge) {
      this.nodes = []; this.edges = [];
      this.groupOverrides = new Map(Object.entries(graph.groupOverrides || {}));
    }
    const idMap = new Map();
    const existingByLabel = new Map(this.nodes.map(n => [n.label.toLowerCase(), n]));
    (graph.nodes || []).forEach(n => {
      const key = n.label.toLowerCase();
      if (merge && existingByLabel.has(key)) { idMap.set(n.id, existingByLabel.get(key).id); return; }
      const id = 'n' + (this._idSeq++);
      idMap.set(n.id, id);
      const placed = this._placeNewNode();
      this.nodes.push({ id, label: n.label, type: n.type, group: n.group || null, logo: n.logo || null, logoScale: n.logoScale || 1, x: placed.x, y: placed.y });
      existingByLabel.set(key, this.nodes[this.nodes.length - 1]);
    });
    (graph.edges || []).forEach(e => {
      const s = idMap.get(e.source), t = idMap.get(e.target);
      if (!s || !t || s === t) return;
      const dupe = this.edges.some(ex => ex.source === s && ex.target === t && ex.label === (e.label || ''));
      if (dupe) return;
      this.edges.push({ id: 'e' + (this._idSeq++), source: s, target: t, label: e.label || '', style: e.style === 'dashed' ? 'dashed' : 'solid' });
    });
    this.autoLayout({ silent: true });
    this.renderAll();
    this.onChange();
  }

  _placeNewNode() {
    const cx = this.width ? this._toWorld(this.width / 2, this.height / 2).x : 400;
    const cy = this.height ? this._toWorld(this.width / 2, this.height / 2).y : 300;
    return { x: cx - this.NODE_W / 2 + (Math.random() * 60 - 30), y: cy - this.NODE_H / 2 + (Math.random() * 60 - 30) };
  }

  addNode(type) {
    this.pushHistory();
    const p = this._placeNewNode();
    const node = { id: 'n' + (this._idSeq++), label: TYPE_LABEL[type] || 'Component', type, group: null, logo: null, logoScale: 1, x: p.x, y: p.y };
    this.nodes.push(node);
    this.renderAll();
    this.select({ type: 'node', id: node.id });
    this.onChange();
    return node;
  }

  deleteNode(id) {
    this.pushHistory();
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.edges = this.edges.filter(e => e.source !== id && e.target !== id);
    if (this.selected && this.selected.id === id) this.select(null);
    this.renderAll();
    this.onChange();
  }

  deleteEdge(id) {
    this.pushHistory();
    this.edges = this.edges.filter(e => e.id !== id);
    if (this.selected && this.selected.id === id) this.select(null);
    this.renderAll();
    this.onChange();
  }

  deleteSelected() {
    if (!this.selected) return;
    if (this.selected.type === 'node') this.deleteNode(this.selected.id);
    else this.deleteEdge(this.selected.id);
  }

  addEdge(sourceId, targetId, label, style) {
    if (sourceId === targetId) return null;
    const dupe = this.edges.some(e => e.source === sourceId && e.target === targetId);
    if (dupe) return null;
    const edge = { id: 'e' + (this._idSeq++), source: sourceId, target: targetId, label: label || '', style: style === 'dashed' ? 'dashed' : 'solid' };
    this.edges.push(edge);
    return edge;
  }

  setNodeLabel(id, label) {
    const n = this.nodes.find(n => n.id === id);
    if (!n) return;
    n.label = label;
    const els = this.nodeEls.get(id);
    if (els) {
      const lines = this._wrapLabel(els.text, label);
      this._positionSubtitle(els, lines);
      this._setSubtitle(els.subtitle, n);
    }
    this.onChange();
  }

  setNodeType(id, type) {
    const n = this.nodes.find(n => n.id === id);
    if (!n) return;
    n.type = type;
    const els = this.nodeEls.get(id);
    if (els) {
      els.use.setAttribute('href', '#icon-' + type);
      els.badge.setAttribute('class', 'node-icon-badge node-group-' + (TYPE_GROUP[type] || 'generic'));
      this._setSubtitle(els.subtitle, n);
    }
    this.onChange();
  }

  setNodeGroup(id, groupName) {
    const n = this.nodes.find(n => n.id === id);
    if (!n) return;
    n.group = groupName && groupName.trim() ? groupName.trim() : null;
    this.renderAll();
    this.onChange();
  }

  setEdgeLabel(id, label) {
    const e = this.edges.find(e => e.id === id);
    if (!e) return;
    e.label = label;
    const els = this.edgeEls.get(id);
    if (els) els.labelText.textContent = label;
    this.onChange();
  }

  setEdgeStyle(id, style) {
    const e = this.edges.find(e => e.id === id);
    if (!e) return;
    e.style = style === 'dashed' ? 'dashed' : 'solid';
    const els = this.edgeEls.get(id);
    if (els) els.line.classList.toggle('dashed', e.style === 'dashed');
    this.onChange();
  }

  clear() {
    this.pushHistory();
    this.nodes = []; this.edges = [];
    this.groupOverrides.clear();
    this.select(null);
    this.renderAll();
    this.onChange();
  }

  /* ---------- layout ---------- */

  autoLayout(opts = {}) {
    if (!opts.silent) this.pushHistory();
    const { nodes, edges } = this;
    if (!nodes.length) return;
    const layer = new Map(nodes.map(n => [n.id, 0]));
    for (let iter = 0; iter < nodes.length + 1; iter++) {
      let changed = false;
      for (const e of edges) {
        if (!layer.has(e.source) || !layer.has(e.target)) continue;
        if (layer.get(e.source) + 1 > layer.get(e.target)) { layer.set(e.target, layer.get(e.source) + 1); changed = true; }
      }
      if (!changed) break;
    }
    const byLayer = new Map();
    nodes.forEach(n => {
      const l = layer.get(n.id) || 0;
      if (!byLayer.has(l)) byLayer.set(l, []);
      byLayer.get(l).push(n);
    });
    const HGAP = 130, VGAP = 50, MARGIN = 70;
    const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);
    const maxCount = Math.max(...layerKeys.map(k => byLayer.get(k).length));
    const maxLayerHeight = maxCount * this.NODE_H + (maxCount - 1) * VGAP;
    layerKeys.forEach(l => {
      const group = byLayer.get(l);
      const thisHeight = group.length * this.NODE_H + (group.length - 1) * VGAP;
      const offsetY = MARGIN + (maxLayerHeight - thisHeight) / 2;
      group.forEach((n, i) => {
        n.x = MARGIN + l * (this.NODE_W + HGAP);
        n.y = offsetY + i * (this.NODE_H + VGAP);
      });
    });
    if (!opts.silent) { this.renderAll(); this.onChange(); }
  }

  fitToView() {
    if (!this.nodes.length) { this.zoomReset(); return; }
    const xs = this.nodes.map(n => n.x), ys = this.nodes.map(n => n.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const maxX = Math.max(...this.nodes.map(n => n.x + this.NODE_W));
    const maxY = Math.max(...this.nodes.map(n => n.y + this.NODE_H));
    const w = maxX - minX, h = maxY - minY;
    const margin = 60;
    const scale = Math.min((this.width - margin * 2) / w, (this.height - margin * 2) / h, 1.4);
    const finalScale = Math.max(0.2, isFinite(scale) ? scale : 1);
    this.view.scale = finalScale;
    this.view.tx = (this.width - w * finalScale) / 2 - minX * finalScale;
    this.view.ty = (this.height - h * finalScale) / 2 - minY * finalScale;
    this.applyViewTransform();
  }

  zoomReset() { this.view = { scale: 1, tx: 0, ty: 0 }; this.applyViewTransform(); }
  zoomAt(mx, my, factor) {
    const newScale = Math.min(2.5, Math.max(0.2, this.view.scale * factor));
    const w = this._toWorld(mx, my);
    this.view.scale = newScale;
    this.view.tx = mx - w.x * newScale;
    this.view.ty = my - w.y * newScale;
    this.applyViewTransform();
  }
  zoomIn() { this.zoomAt(this.width / 2, this.height / 2, 1.2); }
  zoomOut() { this.zoomAt(this.width / 2, this.height / 2, 1 / 1.2); }

  /* ---------- selection ---------- */

  select(sel) {
    this.selected = sel;
    this.nodeLayer.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
    this.edgeLayer.querySelectorAll('.edge.selected').forEach(el => el.classList.remove('selected'));
    this.labelLayer.querySelectorAll('.edge-label-group.selected').forEach(el => el.classList.remove('selected'));
    if (sel) {
      const els = sel.type === 'node' ? this.nodeEls.get(sel.id) : this.edgeEls.get(sel.id);
      if (els) {
        els.g.classList.add('selected');
        if (els.labelG) els.labelG.classList.add('selected');
      }
    }
    const data = sel
      ? (sel.type === 'node' ? { type: 'node', id: sel.id, node: this.nodes.find(n => n.id === sel.id) }
        : { type: 'edge', id: sel.id, edge: this.edges.find(e => e.id === sel.id) })
      : null;
    this.onSelect(data);
  }

  /* ---------- rendering ---------- */

  renderAll() {
    this.groupLayer.innerHTML = '';
    this.nodeLayer.innerHTML = '';
    this.edgeLayer.innerHTML = '';
    this.labelLayer.innerHTML = '';
    this.nodeEls.clear();
    this.edgeEls.clear();
    this.groupEls.clear();
    this._renderGroups();
    this.edges.forEach(e => this._createEdgeEl(e));
    this.nodes.forEach(n => this._createNodeEl(n));
    this.edges.forEach(e => this._updateEdgePath(e.id));
    if (this.selected) {
      const stillExists = (this.selected.type === 'node' ? this.nodes : this.edges).some(x => x.id === this.selected.id);
      if (!stillExists) this.select(null);
    }
  }

  /* ---------- groups (labeled region containers) ---------- */

  // A manually resized group (see the drag handles in _renderGroups) keeps
  // its box exactly as the user left it; otherwise it auto-fits its members.
  _computeGroupBox(members, name) {
    if (name && this.groupOverrides.has(name)) return { ...this.groupOverrides.get(name) };
    const padX = 30, padTop = 42, padBottom = 22;
    const minX = Math.min(...members.map(n => n.x)) - padX;
    const minY = Math.min(...members.map(n => n.y)) - padTop;
    const maxX = Math.max(...members.map(n => n.x + this.NODE_W)) + padX;
    const maxY = Math.max(...members.map(n => n.y + this.NODE_H)) + padBottom;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  _applyGroupBox(els, box) {
    els.rect.setAttribute('x', box.x);
    els.rect.setAttribute('y', box.y);
    els.rect.setAttribute('width', box.w);
    els.rect.setAttribute('height', box.h);
    const labelW = Math.max(30, els.name.length * 6.6 + 22);
    els.labelBg.setAttribute('x', box.x + 14);
    els.labelBg.setAttribute('y', box.y - 11);
    els.labelBg.setAttribute('width', labelW);
    els.labelBg.setAttribute('height', 22);
    els.labelText.setAttribute('x', box.x + 14 + labelW / 2);
    els.labelText.setAttribute('y', box.y);
    const corners = { nw: [box.x, box.y], ne: [box.x + box.w, box.y], sw: [box.x, box.y + box.h], se: [box.x + box.w, box.y + box.h] };
    for (const corner in corners) {
      const [cx, cy] = corners[corner];
      els.handles[corner].setAttribute('cx', cx);
      els.handles[corner].setAttribute('cy', cy);
    }
  }

  _renderGroups() {
    const byGroup = new Map();
    this.nodes.forEach(n => {
      if (!n.group) return;
      if (!byGroup.has(n.group)) byGroup.set(n.group, []);
      byGroup.get(n.group).push(n);
    });
    // Drop overrides for groups that no longer exist so they don't pile up.
    [...this.groupOverrides.keys()].forEach(name => { if (!byGroup.has(name)) this.groupOverrides.delete(name); });

    byGroup.forEach((members, name) => {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'group-box-g');
      g.setAttribute('data-group', name);
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'group-box');
      rect.setAttribute('rx', 12);
      const labelBg = document.createElementNS(SVG_NS, 'rect');
      labelBg.setAttribute('class', 'group-label-bg');
      labelBg.setAttribute('rx', 5);
      const labelText = document.createElementNS(SVG_NS, 'text');
      labelText.setAttribute('class', 'group-label-text');
      labelText.textContent = name;
      g.appendChild(rect); g.appendChild(labelBg); g.appendChild(labelText);

      const handles = {};
      ['nw', 'ne', 'sw', 'se'].forEach(corner => {
        const h = document.createElementNS(SVG_NS, 'circle');
        h.setAttribute('class', 'group-resize-handle group-resize-' + corner);
        h.setAttribute('data-group', name);
        h.setAttribute('data-corner', corner);
        h.setAttribute('r', 6);
        g.appendChild(h);
        handles[corner] = h;
      });

      this.groupLayer.appendChild(g);
      const els = { g, rect, labelBg, labelText, handles, name };
      this.groupEls.set(name, els);
      this._applyGroupBox(els, this._computeGroupBox(members, name));
    });
  }

  _updateGroupBoxFor(groupName) {
    if (!groupName) return;
    const els = this.groupEls.get(groupName);
    if (!els) return;
    const members = this.nodes.filter(n => n.group === groupName);
    if (!members.length) return;
    this._applyGroupBox(els, this._computeGroupBox(members, groupName));
  }

  _wrapLabel(textEl, label) {
    textEl.innerHTML = '';
    const words = String(label).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const candidate = cur ? cur + ' ' + w : w;
      if (candidate.length > 18 && cur) { lines.push(cur); cur = w; }
      else cur = candidate;
    }
    if (cur) lines.push(cur);
    const capped = lines.slice(0, 2);
    if (lines.length > 2) capped[1] += '…';
    capped.forEach((line, i) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan');
      tspan.setAttribute('x', this.NODE_W / 2);
      tspan.setAttribute('dy', i === 0 ? '0' : '1.15em');
      tspan.textContent = line;
      textEl.appendChild(tspan);
    });
    return capped.length;
  }

  // The subtitle shows the recognized category (e.g. "Database") beneath the
  // main label, unless they're the same word — a plain "Database" node
  // doesn't need "Database" repeated under it.
  _setSubtitle(subtitleEl, n) {
    const category = TYPE_LABEL[n.type] || '';
    const show = category && category.toLowerCase() !== String(n.label).trim().toLowerCase();
    subtitleEl.textContent = show ? category : '';
  }

  // Label first line sits at LABEL_Y; each extra wrapped line adds LINE_H
  // (matching the tspan dy used in _wrapLabel); the subtitle sits SUB_GAP
  // below the last label line so bold text and the gray caption never touch.
  _positionSubtitle(els, labelLines) {
    const LABEL_Y = 74, LINE_H = 14.4, SUB_GAP = 16;
    els.subtitle.setAttribute('y', LABEL_Y + (labelLines - 1) * LINE_H + SUB_GAP);
  }

  _createNodeEl(n) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'node');
    g.setAttribute('data-id', n.id);
    g.setAttribute('transform', `translate(${n.x},${n.y})`);

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('class', 'node-bg');
    rect.setAttribute('width', this.NODE_W);
    rect.setAttribute('height', this.NODE_H);
    rect.setAttribute('rx', 12);
    g.appendChild(rect);

    const badge = document.createElementNS(SVG_NS, 'rect');
    badge.setAttribute('class', 'node-icon-badge node-group-' + (TYPE_GROUP[n.type] || 'generic'));
    badge.setAttribute('x', this.NODE_W / 2 - 20);
    badge.setAttribute('y', 14);
    badge.setAttribute('width', 40);
    badge.setAttribute('height', 40);
    badge.setAttribute('rx', 9);
    g.appendChild(badge);

    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#icon-' + n.type);
    use.setAttribute('class', 'node-icon');
    use.setAttribute('x', this.NODE_W / 2 - 11);
    use.setAttribute('y', 23);
    use.setAttribute('width', 22);
    use.setAttribute('height', 22);
    g.appendChild(use);

    // A user-supplied PNG logo replaces the badge + vector icon entirely
    // when present; both stay in the DOM and are toggled via _applyLogo so
    // switching back to the default icon needs no rebuild.
    const logo = document.createElementNS(SVG_NS, 'image');
    logo.setAttribute('class', 'node-logo');
    logo.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    logo.style.display = 'none';
    g.appendChild(logo);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', 'node-label');
    text.setAttribute('x', this.NODE_W / 2);
    text.setAttribute('y', 74);
    text.setAttribute('text-anchor', 'middle');
    g.appendChild(text);
    const lineCount = this._wrapLabel(text, n.label);

    const subtitle = document.createElementNS(SVG_NS, 'text');
    subtitle.setAttribute('class', 'node-subtitle');
    subtitle.setAttribute('x', this.NODE_W / 2);
    subtitle.setAttribute('text-anchor', 'middle');
    g.appendChild(subtitle);

    const handle = document.createElementNS(SVG_NS, 'circle');
    handle.setAttribute('class', 'node-handle');
    handle.setAttribute('cx', this.NODE_W);
    handle.setAttribute('cy', this.NODE_H / 2);
    handle.setAttribute('r', 7);
    g.appendChild(handle);

    const del = document.createElementNS(SVG_NS, 'g');
    del.setAttribute('class', 'node-delete');
    del.setAttribute('transform', `translate(${this.NODE_W - 4},4)`);
    const delCircle = document.createElementNS(SVG_NS, 'circle');
    delCircle.setAttribute('r', 9);
    const delX = document.createElementNS(SVG_NS, 'path');
    delX.setAttribute('class', 'node-delete-x');
    delX.setAttribute('d', 'M-3.5,-3.5 L3.5,3.5 M3.5,-3.5 L-3.5,3.5');
    del.appendChild(delCircle);
    del.appendChild(delX);
    g.appendChild(del);

    this.nodeLayer.appendChild(g);
    const els = { g, rect, badge, use, logo, text, subtitle, handle, del };
    this._positionSubtitle(els, lineCount);
    this._setSubtitle(subtitle, n);
    this._applyLogo(els, n);
    this.nodeEls.set(n.id, els);
  }

  // Centers the badge/icon or the custom logo image on the same spot at the
  // top of the card, sized by n.logoScale (a PNG logo the user resized).
  _applyLogo(els, n) {
    if (n.logo) {
      els.badge.style.display = 'none';
      els.use.style.display = 'none';
      const size = 40 * (n.logoScale || 1);
      const cx = this.NODE_W / 2, cy = 34;
      els.logo.setAttribute('href', n.logo);
      els.logo.setAttribute('x', cx - size / 2);
      els.logo.setAttribute('y', cy - size / 2);
      els.logo.setAttribute('width', size);
      els.logo.setAttribute('height', size);
      els.logo.style.display = '';
    } else {
      els.badge.style.display = '';
      els.use.style.display = '';
      els.logo.style.display = 'none';
    }
  }

  setNodeLogo(id, dataUrl) {
    const n = this.nodes.find(n => n.id === id);
    if (!n) return;
    n.logo = dataUrl || null;
    if (!n.logo) n.logoScale = 1;
    const els = this.nodeEls.get(id);
    if (els) this._applyLogo(els, n);
    this.onChange();
  }

  setNodeLogoScale(id, scale) {
    const n = this.nodes.find(n => n.id === id);
    if (!n || !n.logo) return;
    n.logoScale = Math.min(2, Math.max(0.5, scale));
    const els = this.nodeEls.get(id);
    if (els) this._applyLogo(els, n);
    this.onChange();
  }

  _createEdgeEl(e) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'edge');
    g.setAttribute('data-id', e.id);

    const hit = document.createElementNS(SVG_NS, 'path');
    hit.setAttribute('class', 'edge-hit');
    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('class', 'edge-line' + (e.style === 'dashed' ? ' dashed' : ''));
    line.setAttribute('marker-end', 'url(#arrowhead)');

    g.appendChild(hit); g.appendChild(line);
    this.edgeLayer.appendChild(g);

    // Labels live in a top-most layer so they never get clipped under a
    // nearby node rectangle, regardless of where the edge midpoint falls.
    const labelG = document.createElementNS(SVG_NS, 'g');
    labelG.setAttribute('class', 'edge-label-group');
    const labelBg = document.createElementNS(SVG_NS, 'rect');
    labelBg.setAttribute('class', 'edge-label-bg');
    labelBg.setAttribute('rx', 8);
    const labelText = document.createElementNS(SVG_NS, 'text');
    labelText.setAttribute('class', 'edge-label');
    labelText.textContent = e.label || '';
    labelG.appendChild(labelBg); labelG.appendChild(labelText);
    this.labelLayer.appendChild(labelG);

    this.edgeEls.set(e.id, { g, hit, line, labelG, labelBg, labelText });
  }

  _anchorPoints(source, target) {
    const W = this.NODE_W, H = this.NODE_H;
    const scx = source.x + W / 2, scy = source.y + H / 2;
    const tcx = target.x + W / 2, tcy = target.y + H / 2;
    const dx = tcx - scx, dy = tcy - scy;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0
        ? { sx: source.x + W, sy: scy, tx: target.x, ty: tcy, horiz: true }
        : { sx: source.x, sy: scy, tx: target.x + W, ty: tcy, horiz: true };
    }
    return dy >= 0
      ? { sx: scx, sy: source.y + H, tx: tcx, ty: target.y, horiz: false }
      : { sx: scx, sy: source.y, tx: tcx, ty: target.y + H, horiz: false };
  }

  // Orthogonal (right-angle) connector with two rounded bends, in the style
  // of a classic architecture diagram — a single smooth curve reads as
  // sloppy next to boxy AWS-style nodes.
  _elbowPath(sx, sy, tx, ty, horizFirst, r) {
    if (horizFirst) {
      const midX = (sx + tx) / 2;
      const dir1 = midX >= sx ? 1 : -1, dir2 = tx >= midX ? 1 : -1, dirV = ty >= sy ? 1 : -1;
      const r1 = Math.min(r, Math.abs(midX - sx), Math.abs(ty - sy) / 2);
      const r2 = Math.min(r, Math.abs(tx - midX), Math.abs(ty - sy) / 2);
      return `M${sx},${sy} L${midX - dir1 * r1},${sy} Q${midX},${sy} ${midX},${sy + dirV * r1} `
        + `L${midX},${ty - dirV * r2} Q${midX},${ty} ${midX + dir2 * r2},${ty} L${tx},${ty}`;
    }
    const midY = (sy + ty) / 2;
    const dir1 = midY >= sy ? 1 : -1, dir2 = ty >= midY ? 1 : -1, dirH = tx >= sx ? 1 : -1;
    const r1 = Math.min(r, Math.abs(midY - sy), Math.abs(tx - sx) / 2);
    const r2 = Math.min(r, Math.abs(ty - midY), Math.abs(tx - sx) / 2);
    return `M${sx},${sy} L${sx},${midY - dir1 * r1} Q${sx},${midY} ${sx + dirH * r1},${midY} `
      + `L${tx - dirH * r2},${midY} Q${tx},${midY} ${tx},${midY + dir2 * r2} L${tx},${ty}`;
  }

  _updateEdgePath(id) {
    const e = this.edges.find(e => e.id === id);
    const els = this.edgeEls.get(id);
    if (!e || !els) return;
    const s = this.nodes.find(n => n.id === e.source);
    const t = this.nodes.find(n => n.id === e.target);
    if (!s || !t) return;
    const { sx, sy, tx, ty, horiz } = this._anchorPoints(s, t);
    const d = this._elbowPath(sx, sy, tx, ty, horiz, 12);
    els.line.setAttribute('d', d);
    els.hit.setAttribute('d', d);

    const mx = (sx + tx) / 2, my = (sy + ty) / 2;
    if (e.label) {
      els.labelText.textContent = e.label;
      els.labelText.setAttribute('x', mx);
      els.labelText.setAttribute('y', my);
      const w = Math.max(20, e.label.length * 6.4 + 16);
      els.labelBg.setAttribute('x', mx - w / 2);
      els.labelBg.setAttribute('y', my - 10.5);
      els.labelBg.setAttribute('width', w);
      els.labelBg.setAttribute('height', 21);
      els.labelG.style.display = '';
    } else {
      els.labelText.textContent = '';
      els.labelG.style.display = 'none';
    }
  }

  _updateEdgesForNode(nodeId) {
    this.edges.forEach(e => {
      if (e.source === nodeId || e.target === nodeId) this._updateEdgePath(e.id);
    });
  }

  _setNodeTransform(n) {
    const els = this.nodeEls.get(n.id);
    if (els) els.g.setAttribute('transform', `translate(${n.x},${n.y})`);
  }

  _capturePointer(pointerId) {
    try { this.svg.setPointerCapture(pointerId); } catch (err) { /* no active pointer for this id — safe to ignore */ }
  }

  _hitTestNode(wx, wy, excludeId) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (n.id === excludeId) continue;
      if (wx >= n.x && wx <= n.x + this.NODE_W && wy >= n.y && wy <= n.y + this.NODE_H) return n;
    }
    return null;
  }

  /* ---------- events ---------- */

  _bindEvents() {
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = this._svgPoint(e.clientX, e.clientY);
      const factor = Math.pow(1.0015, -e.deltaY);
      this.zoomAt(p.x, p.y, factor);
    }, { passive: false });

    this.svg.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    this.svg.addEventListener('pointermove', (e) => this._onPointerMove(e));
    this.svg.addEventListener('pointerup', (e) => this._onPointerUp(e));
    this.svg.addEventListener('pointercancel', (e) => this._onPointerUp(e));
    this.svg.addEventListener('dblclick', (e) => this._onDblClick(e));
  }

  // Double-clicking a region's label chip resets a manually resized box
  // back to auto-fitting its members.
  _onDblClick(e) {
    const labelEl = e.target.closest('.group-label-bg, .group-label-text');
    if (!labelEl) return;
    const name = labelEl.closest('.group-box-g')?.getAttribute('data-group');
    if (!name || !this.groupOverrides.has(name)) return;
    this.pushHistory();
    this.groupOverrides.delete(name);
    this.renderAll();
    this.onChange();
  }

  _pinchMetrics() {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  _startPinch() {
    // Abort whatever single-pointer gesture the first finger started.
    const d = this.drag;
    if (d) {
      if (['node', 'group-move', 'group-resize'].includes(d.type)) {
        if (d.moved) this.onChange();
        else this.history.pop();
      }
      if (d.type === 'connect') {
        this.tempLine.style.display = 'none';
        this.nodeLayer.querySelectorAll('.node.drop-target').forEach(el => el.classList.remove('drop-target'));
      }
    }
    const m = this._pinchMetrics();
    this.drag = { type: 'pinch', lastDist: m.dist, lastMx: m.mx, lastMy: m.my };
  }

  _onPointerDown(e) {
    const target = e.target;
    const p = this._svgPoint(e.clientX, e.clientY);
    const world = this._toWorld(p.x, p.y);

    // A primary pointer means no other pointer is down; drop any stale entries.
    if (e.isPrimary) this.pointers.clear();
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) { this._capturePointer(e.pointerId); this._startPinch(); return; }
    if (this.pointers.size > 2) return;

    const resizeEl = target.closest('.group-resize-handle');
    if (resizeEl) {
      const name = resizeEl.getAttribute('data-group');
      const corner = resizeEl.getAttribute('data-corner');
      const members = this.nodes.filter(n => n.group === name);
      const startBox = this._computeGroupBox(members, name);
      this.pushHistory();
      this._capturePointer(e.pointerId);
      this.drag = { type: 'group-resize', name, corner, startBox, startWorld: world };
      return;
    }

    const groupBodyEl = target.closest('.group-box, .group-label-bg, .group-label-text');
    if (groupBodyEl) {
      const name = groupBodyEl.closest('.group-box-g').getAttribute('data-group');
      const members = this.nodes.filter(n => n.group === name);
      this.pushHistory();
      this._capturePointer(e.pointerId);
      this.drag = {
        type: 'group-move',
        name,
        startPositions: members.map(n => ({ id: n.id, x: n.x, y: n.y })),
        startBox: this._computeGroupBox(members, name),
        hadOverride: this.groupOverrides.has(name),
        startWorld: world,
        moved: false,
      };
      return;
    }

    const delEl = target.closest('.node-delete');
    if (delEl) {
      const id = delEl.closest('.node').getAttribute('data-id');
      // On touch the (invisible) delete button must not fire on an unselected node.
      const armed = e.pointerType !== 'touch' || (this.selected && this.selected.type === 'node' && this.selected.id === id);
      if (armed) { this.deleteNode(id); return; }
    }

    const handleEl = target.closest('.node-handle');
    if (handleEl) {
      const id = handleEl.closest('.node').getAttribute('data-id');
      this._capturePointer(e.pointerId);
      this.drag = { type: 'connect', sourceId: id };
      this.tempLine.style.display = '';
      return;
    }

    const nodeEl = target.closest('.node');
    if (nodeEl) {
      const id = nodeEl.getAttribute('data-id');
      const n = this.nodes.find(n => n.id === id);
      this.select({ type: 'node', id });
      this.pushHistory();
      this._capturePointer(e.pointerId);
      this.drag = { type: 'node', id, offset: { x: world.x - n.x, y: world.y - n.y }, moved: false };
      return;
    }

    const edgeEl = target.closest('.edge');
    if (edgeEl) {
      this.select({ type: 'edge', id: edgeEl.getAttribute('data-id') });
      return;
    }

    this.select(null);
    this._capturePointer(e.pointerId);
    this.drag = { type: 'pan', startTx: this.view.tx, startTy: this.view.ty, startX: p.x, startY: p.y };
  }

  _onPointerMove(e) {
    const p = this._svgPoint(e.clientX, e.clientY);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    if (!this.drag) return;

    if (this.drag.type === 'pinch') {
      if (this.pointers.size < 2) return;
      const m = this._pinchMetrics();
      this.view.tx += m.mx - this.drag.lastMx;
      this.view.ty += m.my - this.drag.lastMy;
      this.zoomAt(m.mx, m.my, m.dist / this.drag.lastDist);
      this.drag.lastDist = m.dist; this.drag.lastMx = m.mx; this.drag.lastMy = m.my;
      return;
    }

    if (this.drag.type === 'pan') {
      this.view.tx = this.drag.startTx + (p.x - this.drag.startX);
      this.view.ty = this.drag.startTy + (p.y - this.drag.startY);
      this.applyViewTransform();
      return;
    }

    const world = this._toWorld(p.x, p.y);

    if (this.drag.type === 'node') {
      const n = this.nodes.find(n => n.id === this.drag.id);
      if (!n) return;
      n.x = world.x - this.drag.offset.x;
      n.y = world.y - this.drag.offset.y;
      this.drag.moved = true;
      this._setNodeTransform(n);
      this._updateEdgesForNode(n.id);
      this._updateGroupBoxFor(n.group);
      return;
    }

    if (this.drag.type === 'group-move') {
      const { name, startPositions, startBox, hadOverride, startWorld } = this.drag;
      const dx = world.x - startWorld.x, dy = world.y - startWorld.y;
      startPositions.forEach(sp => {
        const n = this.nodes.find(n => n.id === sp.id);
        if (!n) return;
        n.x = sp.x + dx;
        n.y = sp.y + dy;
        this._setNodeTransform(n);
        this._updateEdgesForNode(n.id);
      });
      if (hadOverride) {
        const box = { x: startBox.x + dx, y: startBox.y + dy, w: startBox.w, h: startBox.h };
        this.groupOverrides.set(name, box);
        const els = this.groupEls.get(name);
        if (els) this._applyGroupBox(els, box);
      } else {
        this._updateGroupBoxFor(name);
      }
      this.drag.moved = true;
      return;
    }

    if (this.drag.type === 'connect') {
      const src = this.nodes.find(n => n.id === this.drag.sourceId);
      if (!src) return;
      const sx = src.x + this.NODE_W, sy = src.y + this.NODE_H / 2;
      this.tempLine.setAttribute('d', `M${sx},${sy} L${world.x},${world.y}`);
      const hovered = this._hitTestNode(world.x, world.y, src.id);
      this.nodeLayer.querySelectorAll('.node.drop-target').forEach(el => el.classList.remove('drop-target'));
      if (hovered) {
        const els = this.nodeEls.get(hovered.id);
        if (els) els.g.classList.add('drop-target');
      }
      return;
    }

    if (this.drag.type === 'group-resize') {
      const { name, corner, startBox, startWorld } = this.drag;
      const dx = world.x - startWorld.x, dy = world.y - startWorld.y;
      const MIN = 100;
      let { x, y, w, h } = startBox;
      if (corner.includes('w')) { const right = x + w; x = Math.min(startBox.x + dx, right - MIN); w = right - x; }
      if (corner.includes('e')) { w = Math.max(MIN, startBox.w + dx); }
      if (corner.includes('n')) { const bottom = y + h; y = Math.min(startBox.y + dy, bottom - MIN); h = bottom - y; }
      if (corner.includes('s')) { h = Math.max(MIN, startBox.h + dy); }
      const box = { x, y, w, h };
      this.groupOverrides.set(name, box);
      const els = this.groupEls.get(name);
      if (els) this._applyGroupBox(els, box);
      this.drag.moved = true;
      return;
    }
  }

  _onPointerUp(e) {
    this.pointers.delete(e.pointerId);
    if (!this.drag) return;
    if (this.drag.type === 'pinch') {
      if (this.pointers.size < 2) this.drag = null;
      return;
    }
    const p = this._svgPoint(e.clientX, e.clientY);
    const world = this._toWorld(p.x, p.y);

    if (this.drag.type === 'node') {
      if (!this.drag.moved) this.history.pop();
      else this.onChange();
    } else if (this.drag.type === 'group-resize') {
      if (!this.drag.moved) this.history.pop();
      else this.onChange();
    } else if (this.drag.type === 'group-move') {
      if (!this.drag.moved) this.history.pop();
      else this.onChange();
    } else if (this.drag.type === 'connect') {
      const src = this.nodes.find(n => n.id === this.drag.sourceId);
      const target = this._hitTestNode(world.x, world.y, src ? src.id : null);
      this.nodeLayer.querySelectorAll('.node.drop-target').forEach(el => el.classList.remove('drop-target'));
      this.tempLine.style.display = 'none';
      if (src && target) {
        this.pushHistory();
        const edge = this.addEdge(src.id, target.id, '');
        if (edge) { this._createEdgeEl(edge); this._updateEdgePath(edge.id); this.select({ type: 'edge', id: edge.id }); this.onChange(); }
        else this.history.pop();
      }
    }
    this.drag = null;
  }
}

