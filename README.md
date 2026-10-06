# ArcCreator

A static, dependency-free web app for turning a plain-English (or arrow-syntax)
prompt into an interactive architecture diagram with icons — drag nodes, draw
connections, group things into labeled region boxes, drop in your own PNG
logos, and export a clean PNG/SVG.

No build step, no server, no API keys — just open `index.html` in a browser,
or serve the folder with any static file host (GitHub Pages, Netlify, `npx serve`, etc.).

## Generating a diagram from a prompt

Type a description in the **Describe your architecture** box and click
**Generate Diagram**. Two input styles are supported, and can be mixed on
different lines of the same prompt:

- **Plain English** — recognized terms (database, cache, load balancer, API
  gateway, Redis, Kafka, S3, Kubernetes, CDN, auth, monitoring, …) are matched
  to icons automatically, and connector phrases ("reads from", "publishes to",
  "caches results in", …) become labeled arrows between them. Anything
  unrecognized becomes a generic labeled box instead of being dropped.
  > A React frontend calls a Node.js API which reads from a PostgreSQL database
  > and caches results in Redis. The API publishes events to a Kafka queue that
  > triggers a notification service.
  >
- **Arrow syntax**, for an exact flow:
  - `User -> API Gateway -> Service -> Database` — a solid connection
  - `Service -.-> Notifications` — a **dashed** connection
  - `Service -> Cache, Queue` — comma/`and`-separated fan-out to multiple targets
- **Region / group boxes** — prefix a line with `[Name]` to enclose everything
  it touches in a labeled, dashed container box:
  ```
  [Client] User -> Load Balancer
  [Cloud Region] Load Balancer -> API Gateway -> Service -> Database
  ```

Turn on **Add to existing diagram** to merge a new prompt's result into the
current canvas instead of replacing it (matching existing node labels are reused).

For the full matching rules (recognized vocabulary, connector phrases, how
region tags and node merging behave, and common gotchas), see
[`docs/PROMPT_GUIDE.md`](docs/PROMPT_GUIDE.md).

## Editing by hand

- **Drag** a node to reposition it.
- **Connect** two nodes by dragging from the small dot on a node's right edge
  to another node.
- **Select** a node or connection to edit it in the **Properties** panel (see below).
- **Palette** — click any icon on the left to drop a new component on the canvas.
- **+ Node** on the toolbar adds a blank generic node.
- **Pan/zoom** — drag empty canvas to pan, scroll to zoom, or use the toolbar's
  zoom in/out/**Fit** controls.
- **Auto Layout** re-arranges every node into a clean left-to-right flow based
  on connection order.
- **Undo / Redo** cover node/edge add-delete-move, region resizes, and layout changes.

### Node properties

Select a node to edit, in the Properties panel:

- **Label** and **Icon** (25 built-in icons, color-coded by category).
- **Custom logo (PNG)** — upload your own PNG to replace the icon entirely
  (non-PNG files are rejected). Re-encoded and downscaled automatically so a
  huge image doesn't bloat the file. Drag the **Logo size** slider to resize
  it, or **Remove logo** to go back to the built-in icon.
- **Group / Region** — type a name to enclose this node in a labeled region
  box shared with any other node using the same name.

### Connection properties

Select a connection to edit its **label** and its **line style** — toggle
between **Solid** and **Dashed** in the Properties panel (or set it directly
from a prompt with `-.->`).

### Region / group boxes

Nodes sharing a **Group / Region** name (set via a node's properties, or via
`[Name]` in a prompt) are enclosed in a labeled dashed box. Boxes auto-fit
their members by default, but you can also:

- **Drag its dashed body or its label chip** to move the whole region (and
  every node in it) together.
- **Drag any of its four corner handles** to manually resize or reshape it —
  useful when auto-layout happens to place an unrelated node close by and the
  boxes get cramped.
- **Double-click its label chip** to reset it back to auto-fit.

Manual resizes persist through undo/redo, autosave, and JSON export/import.

## Export & import

- **Export ▾ → PNG / SVG** — a cropped, theme-colored image of the current
  diagram (region boxes, logos, dashed lines and all), with a small "Made with
  ArcCreator" watermark in the corner. Resize handles and other editing UI are
  excluded automatically.
- **Export ▾ → JSON** — the full diagram data (nodes, edges, groups, logos,
  manual region sizes), which can be re-imported later via **Import**, or
  merged into the current canvas with **Add to existing diagram**.

## Autosave & theme

Your diagram autosaves to the browser's local storage as you work and is
restored automatically next time you open the page. Toggle **light/dark**
theme with the ◐ button in the header (also affects exported images).

## Keyboard shortcuts

| Keys                                         | Action                                 |
| -------------------------------------------- | -------------------------------------- |
| `Ctrl/Cmd + Z`                             | Undo                                   |
| `Ctrl/Cmd + Y` or `Ctrl/Cmd + Shift + Z` | Redo                                   |
| `Delete` / `Backspace`                   | Delete the selected node or connection |
| `+` / `-`                                | Zoom in / out                          |
| `0`                                        | Reset zoom                             |

## Files

- `index.html` — page structure
- `css/styles.css` — theme (light/dark) and layout
- `js/icons.js` — the icon set (25 hand-drawn line icons) and grouping/colors
- `js/parser.js` — turns prompt text into a `{ nodes, edges }` graph (plain
  English + arrow/dashed-arrow/group-bracket DSL)
- `js/canvas.js` — interactive SVG engine (drag, connect, pan/zoom, undo/redo,
  region boxes and their resize handles, custom logos)
- `js/app.js` — wires the UI together, export/import, autosave, theme, shortcuts