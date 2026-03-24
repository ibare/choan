# Choan

**A design tool that converts UI sketches into LLM-ready prompts.**

Choan lets you sketch UI on a canvas and export it as structured Markdown specs that can be pasted directly into LLMs (Claude, GPT, etc.). It bridges the gap between visual intent and precise textual descriptions for AI-powered development.

---

## Why

Explaining UI context to LLMs with screenshots or verbose descriptions is inefficient. Structured specs work far better — but existing design tools (Figma, Sketch) don't export in LLM-friendly formats, and writing specs manually is tedious.

Choan generates specs like this:

```markdown
## UI Spec

### Elements
- `Card` — rectangle / container / z:1
- `Close Button` — circle / button
- `Background` — rectangle / container

### Layout
- Card: x:320, y:180, z:1, size:400x280
- Close Button: x:680, y:160, z:2, size:40x40

### Triggers
- Close Button.click → Close Card

### Animations
- **Close Card** (2 elements)
  - Card: opacity: 1→0 (0-200ms, ease-out); y: 180→220 (0-200ms, ease-out)
```

---

## Features

### Canvas

- **Shape tools**: Rectangle, Circle, Line — draw by dragging on canvas
- **Select / Move / Resize**: Click to select, drag to move, corner handles to resize
- **Drag select**: Marquee selection for multiple elements
- **Snap & distance measurement**: Edge/center snapping (6px threshold), Alt-key distance labels
- **Z-order layering**: Automatic depth via parent-child hierarchy

### 3D Renderer — Custom WebGL2 SDF Engine

A fully custom **SDF (Signed Distance Field) Ray Marching** renderer instead of standard 2D canvas or Three.js. Same rendering approach as [Adobe Project Neo](https://projectneo.adobe.com/).

- **Mathematically perfect edges**: Resolution-independent, uniform outlines
- **Toon shading**: 2-band cel shading with warm tone adjustment and side darkening
- **2-pass rendering**: Geometry (MRT) → Edge detection (Roberts Cross) → Composite
- **HiDPI optimization**: Adaptive supersampling based on device pixel ratio
- **SDF visual effects**: Pulse (shape expansion on color change), Flash (white blend), Rim glow (edge emission on hover highlight)
- **Texture atlas**: Canvas 2D rendering of component skins → GPU texture atlas

### Context Toolbar

A floating toolbar above the selected element with inline controls:

- **Layout direction**: Free / Row / Column / Grid buttons (for containers)
- **Layout params**: Gap, Padding, Columns (grid) — drag-scrub inputs
- **Frameless toggle**: Hide container background
- **Radius**: Corner radius scrub input (0–max px)
- **Split tool**: Knife icon to divide an element into N children (horizontal/vertical, scroll to adjust count)
- **Sibling sync**: Link icon to propagate property changes (color, radius, frameless, layout) to all sibling elements. Also activated by holding Alt.
- **Color picker**: Inline popover with color canvas, grayscale strip, shade carousel, and used-color history row
- **Skin options**: Per-skin controls (toggle, shuffle, icon picker, etc.)

### Color Picker

- **Color canvas**: Hue (X) × Lightness (Y) picker with drag support
- **Grayscale strip**: Black-to-white vertical strip
- **Shade carousel**: 9-step rolling shade variations centered on the current hue
- **Used-color palette**: Derived from all canvas elements in real-time — auto-updates as colors are applied or removed
- **SDF Glow + Z-Lift**: Hovering a color in the palette highlights matching elements with 3D depth lift and rim glow emission; non-matching elements sink and dim

### Skin System (16 components)

Pre-built UI component skins rendered via Canvas 2D → texture atlas:

| Skin | Description |
|------|-------------|
| switch | Toggle switch |
| checkbox | Checkbox |
| radio | Radio button |
| button | Button with label |
| slider | Horizontal slider |
| text-input | Text input field |
| progress | Progress bar |
| badge | Badge / pill |
| star-rating | Star rating |
| avatar | User avatar |
| search | Search bar |
| dropdown | Dropdown selector |
| text | Text block |
| table-skeleton | Table skeleton |
| image | Image placeholder |
| icon | Icon (Phosphor icon picker) |

Each skin supports `skinOnly` mode (hide SDF body) and skin-specific `componentState` (e.g., `{ on: true }` for switch).

### Device Frames

- **Browser**: 1280×800 (16:10) with title bar
- **Mobile**: 375×812 (iPhone 12/13/14 aspect) with notch and safe insets
- Locked aspect ratio on resize

### Layout Engine

Flexbox-inspired auto-layout for containers:

- **Directions**: `free` / `row` / `column` / `grid`
- **Gap & Padding**: Per-container spacing controls
- **Child sizing**: `equal` / `fill` / `fixed-ratio` / `fixed-px`
- **Grid columns**: Configurable column count
- **Safe insets**: Frame-aware padding (browser title bar, mobile notch)
- **Auto-reparent**: Drag an element into a container to auto-adopt

### Layer Panel

- **Tree view**: Hierarchical display with depth indentation
- **Type icons**: Rectangle / Circle / Line indicators
- **Selection**: Click to select, Shift+click to toggle multi-select
- **Rename All**: Batch rename all elements based on structure (skin name, frame, layout direction)

### Properties Panel

- **Element**: Label, Type, Frame (read-only)
- **Skin**: Skin picker (tile popover with previews), Only Skin toggle
- **Container Layout**: Direction, Columns, Gap, Padding
- **Geometry**: Radius, Line style (solid/dashed), Arrow toggle, Z position, X/Y, Width/Height
- **Triggers**: Click/Hover → Animation bundle binding

### Animation Timeline

- **Keyframe editing**: x, y, width, height, color, radius tracks
- **Easing**: linear / ease / ease-in / ease-out / ease-in-out / spring (damped harmonic oscillator)
- **Animation bundles**: Group multiple element clips into named bundles
- **Preview & scrubbing**: Playhead drag, play/pause/stop controls
- **Ghost preview**: Onion-skin overlay of intermediate frames
- **Triggers**: Bind click/hover events to animation bundles

### Export

- **Markdown**: Structured UI spec with component tree, layout hints, animations
- **YAML**: `.choan` project file (save / load)
- **Platform renderers**: Web (HTML/CSS Flexbox), iOS (SwiftUI), Android (Jetpack Compose) implementation hints

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V / Space | Select tool |
| R | Rectangle tool |
| N | Enter split mode |
| Shift (in split) | Toggle split direction |
| Enter (in split) | Confirm split |
| Escape | Cancel / close |
| Delete / Backspace | Delete selected |
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Alt (hold) | Show distances / Enable sibling sync |

---

## Tech Stack

| Area | Technology |
|------|-----------|
| UI Framework | React 19 + TypeScript |
| State Management | Zustand 5 |
| State Machines | XState 5 |
| Rendering Engine | Custom WebGL2 (SDF Ray Marching) |
| UI Components | Radix UI (Dialog, Popover, Tooltip, Select, Slider, etc.) |
| UI Animation | Framer Motion |
| Build | Vite 8 |
| Test | Vitest |
| Icons | Phosphor Icons |

---

## Render Pipeline

```
Ray March Pass (GBuffer, 2x SS)
  └─ Per-pixel ray → sceneSDF(N) → Toon shade → Rim glow
       ↓
Edge Detection Pass (GBuffer textures)
  └─ Roberts Cross on Normal + ObjectID → outline
       ↓
Downsample (blitFramebuffer 2x→1x)
       ↓
Overlay Pass (native res)
  └─ Selection handles, snap guides, distance labels, split indicators
```

### Per-Element Data (UBO, std140)

| Array | Content |
|-------|---------|
| `uPosType[i]` | world x, y, z, shapeType |
| `uSizeRadius[i]` | half-width, half-height, half-depth, radius |
| `uColorAlpha[i]` | r, g, b, opacity |
| `uEffect[i]` | pulse, flash, glow, skinOnly |
| `uTexRect[i]` | atlas UV offset/scale |

### SDF Primitives

```glsl
// Extruded Rounded Rect (Rectangle, Circle)
float sdExtrudedRoundRect(vec3 p, vec3 b, float r) {
  vec2 q = abs(p.xy) - b.xy + r;
  float d2d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return max(d2d, abs(p.z) - b.z);
}

// Capsule (Line)
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
```

### O(1) Normal — Single-object evaluation

Standard tetrahedron normals evaluate the entire scene SDF 4 times (O(N)). Choan evaluates only the hit object via `singleSDF`, reducing cost to O(1).

```glsl
vec3 calcNormal(vec3 p, int objId) {
  const float h = 0.001;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * singleSDF(p + k.xyy * h, objId) +
    k.yyx * singleSDF(p + k.yyx * h, objId) +
    k.yxy * singleSDF(p + k.yxy * h, objId) +
    k.xxx * singleSDF(p + k.xxx * h, objId)
  );
}
```

---

## Project Structure

```
src/
├── engine/                 # WebGL2 SDF rendering engine
│   ├── renderer.ts         # 2-pass renderer (GBuffer → Edge → Overlay)
│   ├── shaders.ts          # GLSL shaders (ray march + edge detection + rim glow)
│   ├── scene.ts            # ChoanElement[] → UBO (std140)
│   ├── camera.ts           # Perspective camera + ray parameters
│   ├── controls.ts         # OrbitControls (pan / rotate / zoom + damping)
│   ├── overlay.ts          # UI overlay (selection handles, snap guides)
│   ├── sdf.ts              # CPU-side SDF + BVH for hit testing
│   ├── painters.ts         # Canvas 2D skin renderers → texture atlas
│   └── timeline2d.ts       # Timeline canvas renderer
│
├── canvas/                 # React canvas layer
│   ├── SDFCanvas.tsx       # Main canvas component
│   ├── CanvasToolbar.tsx   # Top toolbar (tools, export, theme)
│   ├── ContextToolbar.tsx  # Floating context toolbar (layout, radius, color, split, sync)
│   ├── ColorPicker.tsx     # Color picker (canvas + shades + history)
│   ├── colorHistoryHover.ts # Shared hover state for SDF glow effect
│   ├── NavigationGizmo.tsx # 3D navigation gizmo
│   ├── FrameIndicator.tsx  # Frame boundary indicator
│   ├── DragSelectBox.tsx   # Marquee selection overlay
│   ├── DistanceLabels.tsx  # Alt-key distance labels
│   └── SplitLabels.tsx     # Split mode count indicator
│
├── interaction/            # Input handling
│   ├── usePointerHandlers.ts  # Pointer event router (select, drag, resize, draw, color picker)
│   ├── useKeyboardHandlers.ts # Keyboard shortcuts
│   ├── hotkeyRegistry.ts     # Hotkey → action mapping
│   ├── dragHandlers.ts       # Drag move logic + snap
│   ├── resizeHandlers.ts     # Corner resize logic + snap
│   ├── drawHandlers.ts       # Shape drawing logic
│   ├── dragSelectHandlers.ts # Marquee selection logic
│   ├── colorPickerHandlers.ts # On-canvas color picker
│   ├── splitElement.ts       # Split element into N children
│   ├── hitTest.ts            # BVH-accelerated hit testing
│   └── elementHelpers.ts     # Containment detection, reparenting
│
├── layout/                 # Auto-layout engine
│   ├── autoLayout.ts       # Flexbox-like layout computation
│   ├── containment.ts      # Parent-child containment detection
│   └── animator.ts         # Layout transition animator
│
├── rendering/              # rAF loop & animation evaluation
│   ├── useAnimateLoop.ts   # RequestAnimationFrame loop
│   ├── kfAnimator.ts       # Keyframe animator
│   └── ghostPreview.ts     # Onion-skin preview
│
├── animation/              # Animation system
│   ├── types.ts            # Keyframe, AnimationClip, AnimationBundle
│   ├── animationEvaluator.ts
│   ├── interpolate.ts
│   └── buildLayerTree.ts
│
├── panels/                 # UI panels
│   ├── PropertiesPanel.tsx    # Right panel (element, skin, geometry, triggers)
│   ├── LayerPanel.tsx         # Layer tree with rename-all
│   ├── TimelinePanel.tsx      # Animation timeline
│   ├── TimelineSidebar.tsx    # Timeline sidebar (bundles, playback)
│   ├── ElementSection.tsx     # Label, type, frame
│   ├── SkinSection.tsx        # Skin picker + options
│   ├── GeometrySection.tsx    # Radius, line style, position, size
│   ├── ContainerLayoutSection.tsx # Layout direction, gap, padding
│   ├── TriggersSection.tsx    # Event → animation binding
│   ├── RenderSettingsPanel.tsx # Render settings (extrude depth, outline, toon params)
│   └── TilePopover.tsx        # Tile grid popover (reusable)
│
├── store/                  # Zustand state stores
│   ├── useChoanStore.ts       # Unified facade store
│   ├── useElementStore.ts     # Elements + selection + layout
│   ├── useAnimationStore.ts   # Bundles, clips, keyframes
│   ├── usePreviewStore.ts     # Timeline preview state
│   ├── useUIStore.ts          # Tool, draw color, pending skin/frame
│   └── useRenderSettings.ts   # Render settings (extrude, outline, toon)
│
├── export/                 # Export logic
│   ├── toMarkdown.ts          # UI spec markdown generation
│   ├── toYaml.ts              # .choan file serialization
│   ├── core/                  # Grouping, sibling analysis
│   ├── render/                # Tree rendering
│   └── platforms/             # Web, iOS, Android renderers
│
├── config/                 # Configuration
│   └── skins.ts               # Skin registry (16 components)
│
├── components/ui/          # Radix-based UI components
│   ├── Button.tsx, Input.tsx, Select.tsx, Slider.tsx,
│   ├── Dialog.tsx, Tooltip.tsx, Section.tsx, PropRow.tsx, ...
│
├── coords/                 # Coordinate transforms (pixel ↔ world)
├── constants/              # Shared constants
├── hooks/                  # Custom React hooks
├── utils/                  # Utilities (element naming)
└── __tests__/              # Vitest tests
```

---

## Getting Started

```bash
npm install
npm run dev      # Dev server (localhost:5173)
npm run build    # Production build
npm run test     # Run tests
```

---

## Usage

1. **Draw shapes** — Select Rectangle / Circle / Line from the toolbar, drag on canvas
2. **Apply skins** — Select an element, pick a skin from the Properties panel (Button, Switch, etc.)
3. **Set up layout** — Use the context toolbar to set container layout (Row / Column / Grid), adjust gap and padding
4. **Edit properties** — Properties panel for label, radius, color, triggers
5. **Animate** — Timeline panel: create bundles with `+`, add keyframes, set easing
6. **Bind triggers** — Triggers section: connect click/hover events to animation bundles
7. **Export** — Toolbar Export button to copy Markdown or save `.choan` file

---

## References

- [Inigo Quilez — Distance Functions](https://iquilezles.org/articles/distfunctions/)
- [Inigo Quilez — SDF Normals](https://iquilezles.org/articles/normalsSDF/)
- [Adobe Project Neo](https://projectneo.adobe.com/) — Commercial reference for SDF-based rendering
