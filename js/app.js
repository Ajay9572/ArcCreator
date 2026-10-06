/* Wires the DOM (toolbar, prompt box, palette, properties panel) to the
   ArcCanvas engine and ArcParser. Handles export/import and autosave. */

(() => {
  const STORAGE_KEY = 'arccreator.diagram.v1';
  const THEME_KEY = 'arccreator.theme';

  const svgEl = document.getElementById('canvas');
  const canvas = new ArcCanvas(svgEl);

  const statusText = document.getElementById('statusText');
  const emptyHint = document.getElementById('emptyHint');
  const zoomLabel = document.getElementById('zoomLabel');

  function setStatus(msg) { statusText.textContent = msg; }
  function updateEmptyHint() { emptyHint.classList.toggle('hidden', canvas.nodes.length > 0); }

  /* ---------- icon palette ---------- */

  const paletteEl = document.getElementById('iconPalette');
  ICON_META.forEach(m => {
    const div = document.createElement('div');
    div.className = 'icon-swatch';
    div.setAttribute('data-group', m.group);
    div.setAttribute('data-label', m.label);
    div.title = m.label;
    div.innerHTML = `<svg viewBox="0 0 24 24">${ICON_DEFS[m.id]}</svg>`;
    div.addEventListener('click', () => {
      canvas.addNode(m.id);
      setStatus(`Added "${m.label}" — drag it into place.`);
    });
    paletteEl.appendChild(div);
  });

  const nodeTypeSelect = document.getElementById('nodeTypeSelect');
  ICON_META.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = m.label;
    nodeTypeSelect.appendChild(opt);
  });

  /* ---------- properties panel ---------- */

  const propsEmpty = document.getElementById('propsEmpty');
  const propsNode = document.getElementById('propsNode');
  const propsEdge = document.getElementById('propsEdge');
  const nodeLabelInput = document.getElementById('nodeLabelInput');
  const nodeGroupInput = document.getElementById('nodeGroupInput');
  const edgeLabelInput = document.getElementById('edgeLabelInput');
  const edgeStyleControl = document.getElementById('edgeStyleControl');
  const nodeLogoInput = document.getElementById('nodeLogoInput');
  const nodeLogoPreview = document.getElementById('nodeLogoPreview');
  const removeLogoBtn = document.getElementById('removeLogoBtn');
  const nodeLogoSizeRow = document.getElementById('nodeLogoSizeRow');
  const nodeLogoScale = document.getElementById('nodeLogoScale');

  let currentNodeId = null, currentEdgeId = null;

  function refreshLogoPanel(node) {
    if (node && node.logo) {
      nodeLogoPreview.classList.add('has-logo');
      nodeLogoPreview.style.setProperty('--preview-url', `url("${node.logo}")`);
      removeLogoBtn.classList.remove('hidden');
      nodeLogoSizeRow.classList.remove('hidden');
      nodeLogoScale.value = node.logoScale || 1;
    } else {
      nodeLogoPreview.classList.remove('has-logo');
      nodeLogoPreview.style.removeProperty('--preview-url');
      removeLogoBtn.classList.add('hidden');
      nodeLogoSizeRow.classList.add('hidden');
    }
  }

  canvas.onSelect = (sel) => {
    propsEmpty.classList.add('hidden');
    propsNode.classList.add('hidden');
    propsEdge.classList.add('hidden');
    currentNodeId = null; currentEdgeId = null;
    if (!sel) { propsEmpty.classList.remove('hidden'); return; }
    if (sel.type === 'node' && sel.node) {
      currentNodeId = sel.id;
      nodeLabelInput.value = sel.node.label;
      nodeTypeSelect.value = sel.node.type;
      nodeGroupInput.value = sel.node.group || '';
      refreshLogoPanel(sel.node);
      propsNode.classList.remove('hidden');
    } else if (sel.type === 'edge' && sel.edge) {
      currentEdgeId = sel.id;
      edgeLabelInput.value = sel.edge.label || '';
      edgeStyleControl.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.style === (sel.edge.style || 'solid'));
      });
      propsEdge.classList.remove('hidden');
    } else {
      propsEmpty.classList.remove('hidden');
    }
  };

  nodeLabelInput.addEventListener('input', () => { if (currentNodeId) canvas.setNodeLabel(currentNodeId, nodeLabelInput.value); });
  nodeTypeSelect.addEventListener('change', () => { if (currentNodeId) canvas.setNodeType(currentNodeId, nodeTypeSelect.value); });
  nodeGroupInput.addEventListener('change', () => { if (currentNodeId) canvas.setNodeGroup(currentNodeId, nodeGroupInput.value); });

  // Re-encodes an uploaded PNG at a capped size so a multi-megapixel logo
  // doesn't bloat autosave/export JSON — the visible logo is small anyway.
  function loadPngAsDataUrl(file, maxDim = 256) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Not a valid PNG image.'));
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/png'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  nodeLogoInput.addEventListener('change', async () => {
    const file = nodeLogoInput.files[0];
    nodeLogoInput.value = '';
    if (!file || !currentNodeId) return;
    if (file.type !== 'image/png') { setStatus('Please choose a PNG file for the logo.'); return; }
    try {
      const dataUrl = await loadPngAsDataUrl(file);
      canvas.setNodeLogo(currentNodeId, dataUrl);
      const node = canvas.nodes.find(n => n.id === currentNodeId);
      refreshLogoPanel(node);
      setStatus('Logo added — drag the size slider to resize it.');
    } catch (err) {
      setStatus('Could not load that PNG — try a different file.');
    }
  });

  removeLogoBtn.addEventListener('click', () => {
    if (!currentNodeId) return;
    canvas.setNodeLogo(currentNodeId, null);
    refreshLogoPanel(canvas.nodes.find(n => n.id === currentNodeId));
  });

  nodeLogoScale.addEventListener('input', () => {
    if (currentNodeId) canvas.setNodeLogoScale(currentNodeId, parseFloat(nodeLogoScale.value));
  });
  edgeLabelInput.addEventListener('input', () => { if (currentEdgeId) canvas.setEdgeLabel(currentEdgeId, edgeLabelInput.value); });
  edgeStyleControl.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn || !currentEdgeId) return;
    edgeStyleControl.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    canvas.setEdgeStyle(currentEdgeId, btn.dataset.style);
  });
  document.getElementById('deleteNodeBtn').addEventListener('click', () => { if (currentNodeId) canvas.deleteNode(currentNodeId); });
  document.getElementById('deleteEdgeBtn').addEventListener('click', () => { if (currentEdgeId) canvas.deleteEdge(currentEdgeId); });

  /* ---------- generate from prompt ---------- */

  const promptInput = document.getElementById('promptInput');
  const appendModeToggle = document.getElementById('appendModeToggle');

  const EXAMPLES = [
    'User -> Web App -> API Gateway -> Service -> Database\nService -> Cache\nService -> Queue -> Notifications',
    'A mobile app and a web browser send requests through a load balancer to an API gateway, which routes to a microservice. The microservice reads and writes to a PostgreSQL database and caches results in Redis. It publishes events to a Kafka queue, which triggers a notification service. Monitoring tracks everything, and an auth service handles authentication.',
    'Users connect through a CDN in front of an S3 storage bucket for static assets, while a React frontend calls a Node.js backend service. The backend queries a MongoDB database and stores session data in Redis.',
    '[Client] User -> Load Balancer\n[Cloud Region] Load Balancer -> API Gateway -> Service -> Database\n[Cloud Region] Service -> Cache\n[Cloud Region] Service -> Queue -> Notifications\n[Systems of Record] Auth Service\n[Cloud Region] Service -> Auth Service'
  ];
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = EXAMPLES[Number(chip.dataset.example)] || '';
      promptInput.focus();
    });
  });

  document.getElementById('generateBtn').addEventListener('click', () => {
    const text = promptInput.value.trim();
    if (!text) { setStatus('Type a prompt first.'); promptInput.focus(); return; }
    const graph = ArcParser.parse(text);
    if (!graph.nodes.length) {
      setStatus('No recognizable components found — try terms like "database", "API", "load balancer", or write A -> B -> C.');
      return;
    }
    canvas.loadGraph(graph, { merge: appendModeToggle.checked });
    canvas.fitToView();
    updateEmptyHint();
    setStatus(`Generated ${graph.nodes.length} node(s) and ${graph.edges.length} connection(s).`);
  });

  /* ---------- toolbar ---------- */

  document.getElementById('addNodeBtn').addEventListener('click', () => { canvas.addNode('generic'); updateEmptyHint(); });
  document.getElementById('autoLayoutBtn').addEventListener('click', () => { canvas.autoLayout(); canvas.fitToView(); });
  document.getElementById('undoBtn').addEventListener('click', () => canvas.undo());
  document.getElementById('redoBtn').addEventListener('click', () => canvas.redo());
  document.getElementById('zoomInBtn').addEventListener('click', () => canvas.zoomIn());
  document.getElementById('zoomOutBtn').addEventListener('click', () => canvas.zoomOut());
  document.getElementById('fitBtn').addEventListener('click', () => canvas.fitToView());
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (!canvas.nodes.length) return;
    canvas.clear();
    updateEmptyHint();
    setStatus('Canvas cleared — press Ctrl+Z to undo.');
  });

  canvas.onViewChange = () => { zoomLabel.textContent = Math.round(canvas.view.scale * 100) + '%'; };
  canvas.onChange = () => { updateEmptyHint(); scheduleAutosave(); };

  /* ---------- export ---------- */

  const exportBtn = document.getElementById('exportBtn');
  const exportMenu = document.getElementById('exportMenu');
  exportBtn.addEventListener('click', (e) => { e.stopPropagation(); exportMenu.classList.toggle('open'); });
  document.addEventListener('click', () => exportMenu.classList.remove('open'));

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function themeColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    return {
      bgCanvas: v('--bg-canvas'), bgElevated: v('--bg-elevated'), bgPanel: v('--bg-panel'), border: v('--border'),
      text: v('--text'), textDim: v('--text-dim'), textFaint: v('--text-faint'), accent: v('--accent'),
      client: v('--group-client'), compute: v('--group-compute'), data: v('--group-data'),
      messaging: v('--group-messaging'), network: v('--group-network'), platform: v('--group-platform'),
      generic: v('--group-generic')
    };
  }

  function buildExportSvg() {
    if (!canvas.nodes.length) return null;
    const margin = 40;
    const xs = canvas.nodes.map(n => n.x), ys = canvas.nodes.map(n => n.y);
    let minX = Math.min(...xs), minY = Math.min(...ys);
    let maxX = Math.max(...canvas.nodes.map(n => n.x + canvas.NODE_W));
    let maxY = Math.max(...canvas.nodes.map(n => n.y + canvas.NODE_H));
    // Group containers (and their label chips, which poke out above the box)
    // can extend past every node's own bounds — the crop has to include them.
    canvas.groupEls.forEach(els => {
      [els.rect, els.labelBg].forEach(el => {
        const x = parseFloat(el.getAttribute('x')), y = parseFloat(el.getAttribute('y'));
        const w = parseFloat(el.getAttribute('width')), h = parseFloat(el.getAttribute('height'));
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
      });
    });
    minX -= margin; minY -= margin; maxX += margin; maxY += margin;
    const w = maxX - minX, h = maxY - minY;
    const c = themeColors();

    const clone = svgEl.cloneNode(true);
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
    clone.querySelectorAll('.selected, .drop-target').forEach(el => el.classList.remove('selected', 'drop-target'));
    const temp = clone.querySelector('.temp-edge'); if (temp) temp.remove();
    const bg = clone.querySelector('.canvas-bg'); if (bg) bg.remove();
    const viewport = clone.querySelector('.viewport');
    if (viewport) viewport.setAttribute('transform', `translate(${-minX},${-minY})`);

    const bgRect = document.createElementNS(SVG_NS, 'rect');
    bgRect.setAttribute('x', 0); bgRect.setAttribute('y', 0);
    bgRect.setAttribute('width', w); bgRect.setAttribute('height', h);
    bgRect.setAttribute('fill', c.bgCanvas);
    clone.insertBefore(bgRect, clone.firstChild);

    // Mirrors css/styles.css for the node/edge/group visuals — this has to be
    // kept in sync by hand since a standalone exported SVG can't see the
    // page's own stylesheet.
    const style = document.createElementNS(SVG_NS, 'style');
    style.textContent = `
      .node-bg { fill: ${c.bgElevated}; stroke: ${c.border}; stroke-width: 1.4; }
      .node-icon-badge { stroke: none; }
      .node-icon-badge.node-group-client { fill: ${c.client}; }
      .node-icon-badge.node-group-compute { fill: ${c.compute}; }
      .node-icon-badge.node-group-data { fill: ${c.data}; }
      .node-icon-badge.node-group-messaging { fill: ${c.messaging}; }
      .node-icon-badge.node-group-network { fill: ${c.network}; }
      .node-icon-badge.node-group-platform { fill: ${c.platform}; }
      .node-icon-badge.node-group-generic { fill: ${c.generic}; }
      .node-icon { fill: none; color: #fff; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
      .node-label { fill: ${c.text}; font: 700 12.5px -apple-system, Segoe UI, Roboto, sans-serif; }
      .node-subtitle { fill: ${c.textFaint}; font: 500 10px -apple-system, Segoe UI, Roboto, sans-serif; }
      .node-handle, .node-delete, .group-resize-handle { display: none; }
      .group-box { fill: ${c.accent}; fill-opacity: 0.045; stroke: ${c.accent}; stroke-opacity: 0.55; stroke-width: 1.5; stroke-dasharray: 7 5; }
      .group-label-bg { fill: ${c.bgPanel}; stroke: ${c.border}; stroke-width: 1; }
      .group-label-text { fill: ${c.textDim}; font: 700 10.5px -apple-system, Segoe UI, Roboto, sans-serif; text-anchor: middle; dominant-baseline: middle; }
      .edge-line { fill: none; stroke: ${c.textFaint}; stroke-width: 1.6; }
      .edge-line.dashed { stroke-dasharray: 6 5; }
      .edge-hit { display: none; }
      .arrowhead-fill { fill: ${c.textFaint}; }
      .edge-label-bg { fill: ${c.bgPanel}; stroke: ${c.border}; stroke-width: 1; }
      .edge-label { fill: ${c.textDim}; font: 600 10.5px -apple-system, Segoe UI, Roboto, sans-serif; text-anchor: middle; dominant-baseline: middle; }
    `;
    clone.insertBefore(style, clone.firstChild);

    const watermark = document.createElementNS(SVG_NS, 'text');
    watermark.setAttribute('x', w - 12);
    watermark.setAttribute('y', h - 10);
    watermark.setAttribute('text-anchor', 'end');
    watermark.setAttribute('fill', c.textFaint);
    watermark.setAttribute('style', 'font: 500 10.5px -apple-system, Segoe UI, Roboto, sans-serif; opacity: 0.7;');
    watermark.textContent = 'Made with ArcCreator';
    clone.appendChild(watermark);

    return { svgString: new XMLSerializer().serializeToString(clone), w, h };
  }

  function exportSVG() {
    const built = buildExportSvg();
    if (!built) { setStatus('Nothing to export yet.'); return; }
    const blob = new Blob([built.svgString], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, 'architecture-diagram.svg');
    setStatus('Exported SVG.');
  }

  function exportPNG() {
    const built = buildExportSvg();
    if (!built) { setStatus('Nothing to export yet.'); return; }
    const blob = new Blob([built.svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const c = document.createElement('canvas');
      c.width = built.w * scale; c.height = built.h * scale;
      const ctx = c.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, built.w, built.h);
      c.toBlob(pngBlob => {
        downloadBlob(pngBlob, 'architecture-diagram.png');
        URL.revokeObjectURL(url);
        setStatus('Exported PNG.');
      });
    };
    img.onerror = () => setStatus('PNG export failed.');
    img.src = url;
  }

  function exportJSON() {
    if (!canvas.nodes.length) { setStatus('Nothing to export yet.'); return; }
    const data = JSON.stringify({ nodes: canvas.nodes, edges: canvas.edges, groupOverrides: Object.fromEntries(canvas.groupOverrides) }, null, 2);
    downloadBlob(new Blob([data], { type: 'application/json' }), 'architecture-diagram.json');
    setStatus('Exported JSON.');
  }

  exportMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-export]');
    if (!btn) return;
    if (btn.dataset.export === 'svg') exportSVG();
    else if (btn.dataset.export === 'png') exportPNG();
    else if (btn.dataset.export === 'json') exportJSON();
  });

  const importBtn = document.getElementById('importBtn');
  const importInput = document.getElementById('importInput');
  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    const file = importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.nodes)) throw new Error('missing nodes');
        data.nodes.forEach(n => { if (!ICON_DEFS[n.type]) n.type = 'generic'; });
        canvas.loadGraph(data, { merge: false });
        canvas.fitToView();
        updateEmptyHint();
        setStatus(`Imported ${data.nodes.length} node(s).`);
      } catch (err) {
        setStatus('Import failed: not a valid ArcCreator JSON file.');
      }
      importInput.value = '';
    };
    reader.readAsText(file);
  });

  /* ---------- theme ---------- */

  const themeBtn = document.getElementById('themeBtn');
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  /* ---------- autosave ---------- */

  let autosaveTimer = null;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try {
        const data = { nodes: canvas.nodes, edges: canvas.edges, groupOverrides: Object.fromEntries(canvas.groupOverrides) };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) { /* storage full or unavailable — ignore */ }
    }, 400);
  }

  (function restoreAutosave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.nodes || !data.nodes.length) return;
      canvas.nodes = data.nodes;
      canvas.edges = data.edges || [];
      canvas.groupOverrides = new Map(Object.entries(data.groupOverrides || {}));
      canvas._idSeq = data.nodes.length + (data.edges || []).length + 1;
      canvas.renderAll();
      canvas.fitToView();
      setStatus('Restored your last diagram.');
    } catch (e) { /* ignore corrupt autosave */ }
  })();
  updateEmptyHint();

  /* ---------- keyboard shortcuts ---------- */

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); canvas.undo(); return; }
    if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); canvas.redo(); return; }
    if (typing) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); canvas.deleteSelected(); }
    else if (e.key === '+' || e.key === '=') { canvas.zoomIn(); }
    else if (e.key === '-') { canvas.zoomOut(); }
    else if (e.key === '0') { canvas.zoomReset(); }
  });
})();

