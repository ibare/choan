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
- **Diamond keyframe buttons**: Per-property keyframe toggle (add/remove at playhead)
- **Easing**: linear / ease / ease-in / ease-out / ease-in-out / spring (damped harmonic oscillator)
- **Animation bundles**: Group multiple element clips into named bundles
- **Preview & scrubbing**: Playhead drag, play/pause/stop controls
- **Ghost preview**: Onion-skin overlay of intermediate frames
- **Triggers**: Bind click/hover events to animation bundles

### Director Mode — Camera System

A cinematic camera system for creating animated camera sequences without traditional keyframe editing.

#### Design Principles

- **No keyframe UI** — keyframes exist internally but are never exposed to the user
- **Rail metaphor** — camera movement is defined by physical rails, not abstract time-position pairs
- **Single target** — one target object per scene that the camera always looks at
- **Minimal concepts** — only two things to think about: "where the camera is" and "what it looks at"

#### Multi-Camera System

Director mode supports multiple cameras on a single timeline:

- **Add / Delete**: Create multiple independent cameras, each with its own rail configuration
- **Camera selection**: Click a camera's frustum icon to select it; selected camera drives the Viewfinder
- **Selection priority system**: `lastInteraction` tracks whether the user last moved the camera or the playhead, resolving ambiguous state (e.g., which camera position to show)
- **Camera time tracking**: `findCameraDerivedPose()` derives camera pose from clip position and playhead time

#### Camera Object

- Exists as a 3D scene object (separate from the viewport camera)
- Always points at the **Target Object** (amber cross marker in 3D view)
- Selected by clicking its frustum icon in the 3D viewport
- Draggable via **ray-plane intersection** on the view-perpendicular plane
- New cameras spawn at world origin with a default Z=18 distance

#### Rail System

Each axis has a rail that defines the camera's range of movement:

| Rail | Axis | Modes | Description |
|------|------|-------|-------------|
| **Truck** | X | Linear / Circular | Left-right movement |
| **Boom** | Y | Linear / Circular | Up-down movement |
| **Dolly** | Z | Linear only | Forward-backward movement |

**Rail states:**
- **Red stub** (minimum) — rail exists but no movement range
- **Blue extension** — active movement range, camera can slide within

**Rail interaction:**
- Pull anchor handle outward → extend rail range
- Double-click anchor → toggle Linear ↔ Circular mode (Truck/Boom only)
- Camera automatically constrained within extended rail range
- Alt + drag → override constraint, move camera + rail together

**Rail timing:**
Each rail has an independent animation interval (`startTime` / `endTime`) and easing curve, allowing per-axis timing control without exposing keyframes:

```typescript
RailExtents {
  neg: number        // negative extent
  pos: number        // positive extent
  startTime: number  // animation start (ms)
  endTime: number    // animation end (ms)
  easing?: EasingType
}
```

#### Circular Rails

- **X circular**: horizontal orbit in XZ plane, center on Y-axis at Z=0
- **Y circular**: vertical orbit in the camera's heading plane, center at origin
- Radius = distance from camera to orbit center (implicit, no extra control)
- Rail extent maps to arc length on the circle

#### Rail Slider Controller

When a rail is extended, a **slider widget** replaces the raw axis tunnel for that axis:

- Three sliders (X / Y / Z) positioned around the camera object
- Each slider maps to its rail's full extent range
- Dragging the slider knob → camera slides along the rail
- Non-extended axes still accept direct drag on the tunnel face

#### Camera Clip Timeline (FCP Style)

Director mode features a **Final Cut Pro-style clip timeline** for arranging camera sequences:

- **CameraClip**: A discrete block on the timeline with `cameraId`, `timelineStart`, `duration`, and an embedded `cameraSetup` snapshot
- **Clip editing**: Click to select, drag to move, drag edges to resize duration
- **Magnetic snap**: Clip edges snap to adjacent clip boundaries with visual feedback
- **Ripple editing**: Moving a clip pushes adjacent clips to prevent gaps
- **Overlap prevention**: Clips on the same lane cannot overlap; repositioning enforces valid layout
- **Compound clip editing**: Double-click a clip to enter detail mode and edit its internal rail timing

#### Lane-Based Timeline (NLE Style)

Clips are assigned to **lanes** (tracks) using a non-destructive NLE algorithm:

- `resolveLane()` places each clip on the lowest-indexed lane with no overlap
- Multiple cameras can exist simultaneously on different lanes
- Lane count grows dynamically as clips are added

#### Event Marker System

**EventMarkers** schedule animation bundles at specific timeline positions:

- Each marker references a named animation bundle and a trigger time
- Evaluated during Director playback via `directorEventEvaluator`
- Visible on the timeline as labeled pins

#### Frustum Spotlight (Q key)

- Hybrid frustum mask: surface pixels get crisp boundary, background gets volumetric cone
- Warm amber face colors with per-face brightness levels
- Entry-face detection via Liang-Barsky algorithm
- Frustum geometry computed from a single source (`frustumGeometry.ts`) shared across rendering and interaction

#### Viewfinder

- Inspector panel showing the selected director camera's live view
- Displayed only when a camera is selected
- Aspect ratio options: 16:9, 4:3, 1:1, 9:16, 2.35:1
- Focal length slider: 10–200mm

#### Target Object

- Single world-space object (amber cross + disc) visible only in Director mode
- Camera always looks at it
- **Draggable**: Drag the target marker to reposition it in world space
- **Elevation angle constraint**: Tilt angle capped at `TARGET_DRAG_MAX_TILT_DEG`; angle label displayed during drag
- **Locked mode** (`targetMode: 'locked'`): Target rotates with the camera, maintaining relative bearing — useful for circular orbits
- **Fixed mode** (`targetMode: 'fixed'`): Target stays at its world position regardless of camera movement
- **Element attachment**: Target can be attached to a scene element for follow shots

#### Camera Framing (Z key)

- Moves the selected element to the world origin and frames the director camera to it
- Useful for quickly centering a composition on a specific object

#### Camera Front Alignment

- Aligns the director camera to face the +Z axis directly (orthographic front view equivalent)
- Available as a button in the Director panel

#### Video Export

- Renders the Director timeline to **WebM** video via `videoExporter.ts`
- Configurable: resolution, FPS, duration
- Uses OffscreenCanvas for frame-by-frame WebGL capture

#### Keyboard Shortcuts (Director Mode)

| Key | Action |
|-----|--------|
| Q | Toggle frustum spotlight |
| Z | Frame selected element to origin + camera |
| Double-click rail handle | Toggle Linear ↔ Circular rail mode |
| Alt + axis drag | Override rail constraint |

### Export

- **Markdown**: Structured UI spec with component tree, layout hints, animations
- **YAML**: `.choan` project file (save / load)
- **Video**: WebM recording of Director timeline playback
- **Platform renderers**: Web (HTML/CSS Flexbox), iOS (SwiftUI), Android (Jetpack Compose) implementation hints

### Project Storage

Projects are persisted via **IndexedDB** (replaced the earlier localStorage approach):

- Auto-save on change (debounced)
- `ProjectRecord` structure stores full canvas + animation + director state
- `persistence.ts` handles read/write lifecycle

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
| Z (Director mode) | Frame selected element to origin |

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
| Storage | IndexedDB (via `persistence.ts`) |

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
│   ├── catmullRom.ts       # Catmull-Rom spline interpolation
│   ├── timeline2d.ts       # 2D timeline canvas rendering entry point
│   ├── timeline2dRenderer.ts   # Timeline draw loop + clip layout
│   ├── timeline2dPrimitives.ts # Timeline primitives (clip rect, lane lines, etc.)
│   ├── timeline2dTypes.ts  # Timeline rendering types
│   └── videoExporter.ts    # WebM video export via OffscreenCanvas
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
│   ├── SplitLabels.tsx     # Split mode count indicator
│   ├── ElevationAngleLabel.tsx # Camera target drag elevation angle label
│   ├── RailTimeLabels.tsx  # Rail animation timing labels with leader lines
│   └── PinOverlay.tsx      # Container child sizing mode pin toggle
│
├── interaction/            # Input handling
│   ├── usePointerHandlers.ts  # Pointer event router (select, drag, resize, draw, color picker, rail/axis drag)
│   ├── useKeyboardHandlers.ts # Keyboard shortcuts
│   ├── cameraPathHandlers.ts  # Camera/rail hit testing, rail handle positions
│   ├── hotkeyRegistry.ts     # Hotkey → action mapping
│   ├── dragHandlers.ts       # Drag move logic + snap
│   ├── resizeHandlers.ts     # Corner resize logic + snap
│   ├── drawHandlers.ts       # Shape drawing logic
│   ├── dragSelectHandlers.ts # Marquee selection logic
│   ├── colorPickerHandlers.ts # On-canvas color picker
│   ├── splitElement.ts       # Split element into N children
│   ├── frameSelection.ts     # Z-key frame-to-origin + camera framing
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
│   ├── cameraPathOverlay.ts # Camera frustum, rail, target rendering
│   ├── zTunnelOverlay.ts   # XYZ axis tunnels, ground grid, camera footprint
│   ├── frustumGeometry.ts  # Frustum geometry (single source shared across rendering/interaction)
│   ├── elevationLabel.ts   # Elevation angle label DOM updates
│   ├── multiSelectTint.ts  # Multi-select color tint override
│   ├── kfAnimator.ts       # Keyframe animator
│   └── ghostPreview.ts     # Onion-skin preview
│
├── animation/              # Animation system
│   ├── types.ts            # Keyframe, AnimationClip, AnimationBundle
│   ├── directorTypes.ts    # Rail system types, CameraClip, EventMarker, RailExtents
│   ├── directorCameraEvaluator.ts  # Catmull-Rom camera interpolation
│   ├── directorEventEvaluator.ts   # Event marker evaluation
│   ├── cameraTimeTrack.ts  # Clip-based camera pose derivation (findCameraDerivedPose)
│   ├── cameraMarkEvaluator.ts # Camera mark interpolation along rails
│   ├── cameraPresets.ts    # Camera presets (Orbit, Dolly, Crane, Pan, Fly-through)
│   ├── keyframeEngine.ts   # Animation playback engine
│   ├── addKeyframe.ts      # Add/remove keyframes at playhead
│   ├── autoKeyframe.ts     # Auto-keyframe on property change
│   ├── propagateDelta.ts   # Parent-child property delta propagation
│   ├── animationEvaluator.ts
│   ├── interpolate.ts
│   └── buildLayerTree.ts
│
├── panels/                 # UI panels
│   ├── PropertiesPanel.tsx    # Right panel (element, skin, geometry, triggers)
│   ├── LayerPanel.tsx         # Layer tree with rename-all
│   ├── TimelinePanel.tsx      # Animation timeline
│   ├── DirectorTimelinePanel.tsx # Director mode timeline (camera clips, event markers, lanes)
│   ├── Viewfinder.tsx         # Director camera live preview (shown on camera selection)
│   ├── TimelineSidebar.tsx    # Timeline sidebar (bundles, playback)
│   ├── VideoExportDialog.tsx  # WebM video export settings dialog
│   ├── SceneTabBar.tsx        # Scene tab navigation bar
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
│   ├── useDirectorStore.ts    # Director mode (cameras[], clips[], rails, target, selection priority)
│   ├── usePreviewStore.ts     # Timeline preview state
│   ├── useUIStore.ts          # Tool, draw color, pending skin/frame
│   ├── useRenderSettings.ts   # Render settings (extrude, outline, toon)
│   └── persistence.ts         # IndexedDB-based project save/load
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
│   ├── Dialog.tsx, Tooltip.tsx, Section.tsx, PropRow.tsx,
│   └── KeyframeButton.tsx     # Diamond keyframe toggle button
│
├── coords/                 # Coordinate transforms (pixel ↔ world, ray-plane/axis intersection)
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
5. **Animate** — Timeline panel: create bundles with `+`, add keyframes via diamond buttons, set easing
6. **Bind triggers** — Triggers section: connect click/hover events to animation bundles
7. **Director mode** — Add cameras, arrange clips on the timeline, set rail extents and timing per axis
8. **Export** — Toolbar Export button to copy Markdown, save `.choan` file, or render WebM video

---

## References

- [Inigo Quilez — Distance Functions](https://iquilezles.org/articles/distfunctions/)
- [Inigo Quilez — SDF Normals](https://iquilezles.org/articles/normalsSDF/)
- [Adobe Project Neo](https://projectneo.adobe.com/) — Commercial reference for SDF-based rendering
