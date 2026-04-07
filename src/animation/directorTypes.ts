// Director Timeline type definitions — scene-level camera + event scheduling.

import type { EasingType } from './types'

// ── Rail system ──────────────────────────────────────────────────────────────
// Each rail has neg/pos extents. Truck (X) and Boom (Y) support circular mode
// where the rail becomes an arc centered at Z=0.
// Dolly (Z) is always linear.

export const RAIL_MIN_STUB = 0.5  // world units — minimum red stub per side

export type RailMode = 'linear' | 'circular'

export interface RailExtents {
  neg: number
  pos: number
  /** Clip-relative time (ms) when movement starts. 0 = not set. */
  startTime: number
  /** Clip-relative time (ms) when movement ends. 0 = not set. */
  endTime: number
  /** Easing curve applied to the movement. */
  easing?: EasingType
}

export interface DirectorRails {
  dolly:     RailExtents  // Z axis (forward / backward) — linear only
  truck:     RailExtents  // X axis (left / right)
  boom:      RailExtents  // Y axis (up / down)
  truckMode: RailMode     // X axis rail mode
  boomMode:  RailMode     // Y axis rail mode
}

export type RailAxis = 'dolly' | 'truck' | 'boom'
export type RailDir  = 'neg' | 'pos'
export interface RailHandleId { axis: RailAxis; dir: RailDir }

function defaultExtents(): RailExtents {
  return { neg: RAIL_MIN_STUB, pos: RAIL_MIN_STUB, startTime: 0, endTime: 0 }
}

export function createDefaultRails(): DirectorRails {
  return {
    dolly:     defaultExtents(),
    truck:     defaultExtents(),
    boom:      defaultExtents(),
    truckMode: 'linear',
    boomMode:  'linear',
  }
}

/** Backfill startTime/endTime for old RailExtents data missing these fields. */
export function migrateRailExtents(ext: Partial<RailExtents>): RailExtents {
  return {
    neg: ext.neg ?? RAIL_MIN_STUB,
    pos: ext.pos ?? RAIL_MIN_STUB,
    startTime: ext.startTime ?? 0,
    endTime: ext.endTime ?? 0,
    easing: ext.easing,
  }
}

/** Check if a rail axis has active animation timing. */
export function isRailAnimated(ext: RailExtents): boolean {
  const isExtended = ext.neg > RAIL_MIN_STUB + 0.001 || ext.pos > RAIL_MIN_STUB + 0.001
  return isExtended && ext.startTime !== ext.endTime
}

/** Check if any axis in DirectorRails has active animation. */
export function hasActiveRailTiming(rails: DirectorRails): boolean {
  return isRailAnimated(rails.truck) || isRailAnimated(rails.boom) || isRailAnimated(rails.dolly)
}

// ── Circular rail math utilities ─────────────────────────────────────────────

/** X circular (truck): horizontal orbit in XZ plane at camera Y height. */
export function truckCircularParams(camPos: [number, number, number]) {
  const cx = 0, cy = camPos[1], cz = 0  // center on Y-axis at cam height
  const radius = Math.sqrt(camPos[0] ** 2 + camPos[2] ** 2)
  const angle = Math.atan2(camPos[0], camPos[2])  // angle from +Z axis
  return { center: [cx, cy, cz] as [number, number, number], radius, angle }
}

/** Y circular (boom): vertical orbit in the plane containing Y-axis and camera XZ direction. */
export function boomCircularParams(camPos: [number, number, number]) {
  const hDist = Math.sqrt(camPos[0] ** 2 + camPos[2] ** 2)
  const hAngle = Math.atan2(camPos[0], camPos[2])  // horizontal heading
  const radius = Math.sqrt(hDist ** 2 + camPos[1] ** 2)
  const elevAngle = Math.atan2(camPos[1], hDist)    // elevation from XZ plane
  return { center: [0, 0, 0] as [number, number, number], radius, elevAngle, hAngle }
}

/** Point on X circular orbit. */
export function pointOnTruckCircle(
  center: [number, number, number], radius: number, angle: number,
): [number, number, number] {
  return [center[0] + Math.sin(angle) * radius, center[1], center[2] + Math.cos(angle) * radius]
}

/** Point on Y circular orbit (vertical arc in the camera's heading plane). */
export function pointOnBoomCircle(
  radius: number, elevAngle: number, hAngle: number,
): [number, number, number] {
  const h = Math.cos(elevAngle) * radius
  const y = Math.sin(elevAngle) * radius
  return [Math.sin(hAngle) * h, y, Math.cos(hAngle) * h]
}

// ── Per-axis camera marks (DEPRECATED — replaced by rail timing) ────────

/** Which axis channel an AxisMark belongs to. */
export type AxisMarkChannel = 'truck' | 'boom' | 'dolly'

/** Axis index lookup: truck→0(X), boom→1(Y), dolly→2(Z). */
export const AXIS_MARK_IDX: Record<AxisMarkChannel, number> = { truck: 0, boom: 1, dolly: 2 }

/** A single mark on one axis. Stores an offset value relative to railWorldAnchor. */
export interface AxisMark {
  id: string
  channel: AxisMarkChannel
  time: number        // absolute ms within scene
  value: number       // offset along axis from railWorldAnchor (world units)
  easing?: EasingType // curve from this mark to the next mark on same channel
}

/** Default empty axis marks record. */
export function createDefaultAxisMarks(): Record<AxisMarkChannel, AxisMark[]> {
  return { truck: [], boom: [], dolly: [] }
}

// ── Camera marks (unified, kept for backward compat) ─────────────────────

export interface CameraMark {
  id: string
  time: number                        // absolute ms within scene
  position: [number, number, number]  // 3D world position (on rail)
  target: [number, number, number]    // target position
  focalLengthMm: number              // focal length in mm
  easing?: EasingType                // curve from this mark to next
}

// ── Camera keyframes (legacy, kept for backward compat) ──────────────────

export interface CameraViewKeyframe {
  id: string
  time: number  // absolute ms within scene
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  easing?: EasingType
  tension?: number  // Catmull-Rom tension, default 0.5
}

export interface EventMarker {
  id: string
  time: number            // absolute start ms
  bundleId: string        // references existing AnimationBundle
  durationOverride?: number  // optional: override bundle's natural duration
  lane?: number           // track lane index (default 0)
}

export type TargetMode = 'fixed' | 'locked'

export interface DirectorCameraSetup {
  cameraPos: [number, number, number]
  targetPos: [number, number, number]
  targetMode: TargetMode
  rails: DirectorRails
  railWorldAnchor: [number, number, number]
  targetAttachedTo: string | null
}

// ── Director Camera (multi-camera entity) ──────────────────────────────

export interface DirectorCamera {
  id: string
  name: string
  setup: DirectorCameraSetup
  focalLengthMm: number
  viewfinderAspect: string  // e.g. '16:9', '4:3'
}

export function createDefaultCamera(id?: string): DirectorCamera {
  return {
    id: id ?? '',
    name: 'Camera 1',
    setup: {
      cameraPos: [0, 0, 18],
      targetPos: [0, 0, 0],
      targetMode: 'fixed',
      rails: createDefaultRails(),
      railWorldAnchor: [0, 0, 18],
      targetAttachedTo: null,
    },
    focalLengthMm: 38,
    viewfinderAspect: '16:9',
  }
}

// ── Camera Clip (FCP-style) ─────────────────────────────────────────────

export interface CameraClip {
  id: string
  name: string
  cameraId: string         // which camera this clip belongs to
  timelineStart: number    // absolute ms on the director timeline
  duration: number         // clip length in ms (default 3000)
  cameraSetup: DirectorCameraSetup
  focalLengthMm: number   // per-clip focal length
  lane?: number            // track lane index (default 0)
}

const DEFAULT_CLIP_DURATION = 3000

export function createDefaultCameraClip(setup?: DirectorCameraSetup, cameraId?: string): CameraClip {
  return {
    id: '',  // caller must assign via nanoid
    name: 'Camera 1',
    cameraId: cameraId ?? '',
    timelineStart: 0,
    duration: DEFAULT_CLIP_DURATION,
    cameraSetup: setup ?? {
      cameraPos: [0, 0, 18],
      targetPos: [0, 0, 0],
      targetMode: 'fixed',
      rails: createDefaultRails(),
      railWorldAnchor: [0, 0, 18],
      targetAttachedTo: null,
    },
    focalLengthMm: 38,
  }
}

/** Find the active camera clip at a given absolute time. Later-starting clips take priority. */
export function findActiveClip(clips: CameraClip[], time: number): CameraClip | null {
  let best: CameraClip | null = null
  for (const clip of clips) {
    if (time >= clip.timelineStart && time < clip.timelineStart + clip.duration) {
      if (!best || clip.timelineStart > best.timelineStart) best = clip
    }
  }
  return best
}

// ── Director Timeline ───────────────────────────────────────────────────

export interface DirectorTimeline {
  cameras: DirectorCamera[]
  cameraClips: CameraClip[]
  // Legacy (backward compat)
  cameraMarks: CameraMark[]
  cameraKeyframes: CameraViewKeyframe[]
  eventMarkers: EventMarker[]
  cameraSetup?: DirectorCameraSetup
  axisMarks?: Record<AxisMarkChannel, AxisMark[]>
}

export function createDefaultDirectorTimeline(): DirectorTimeline {
  return { cameras: [], cameraClips: [], cameraMarks: [], cameraKeyframes: [], eventMarkers: [] }
}

/** Migrate legacy DirectorTimeline to multi-camera + clip-based system. */
export function migrateDirectorTimeline(dt: DirectorTimeline): DirectorTimeline {
  let result = { ...dt }

  // Ensure cameras array exists
  if (!result.cameras) result.cameras = []

  // Migrate legacy cameraSetup or first clip into cameras array
  if (result.cameras.length === 0) {
    if (result.cameraSetup) {
      result.cameras = [{
        id: 'migrated-cam-1',
        name: 'Camera 1',
        setup: { ...result.cameraSetup, targetMode: result.cameraSetup.targetMode ?? 'fixed' },
        focalLengthMm: 38,
        viewfinderAspect: '16:9',
      }]
    } else if (result.cameraClips && result.cameraClips.length > 0) {
      const firstClip = result.cameraClips[0]
      result.cameras = [{
        id: 'migrated-cam-1',
        name: 'Camera 1',
        setup: { ...firstClip.cameraSetup, targetMode: firstClip.cameraSetup.targetMode ?? 'fixed' },
        focalLengthMm: firstClip.focalLengthMm,
        viewfinderAspect: '16:9',
      }]
    }
  }

  // Assign cameraId to clips missing it
  if (result.cameras.length > 0) {
    const defaultCamId = result.cameras[0].id
    result.cameraClips = (result.cameraClips ?? []).map(clip =>
      clip.cameraId ? clip : { ...clip, cameraId: defaultCamId },
    )
  }

  // Migrate legacy cameraSetup to a single clip (if no clips exist)
  if ((!result.cameraClips || result.cameraClips.length === 0) && result.cameraSetup) {
    const camId = result.cameras[0]?.id ?? ''
    const clip = createDefaultCameraClip(result.cameraSetup, camId)
    clip.id = 'migrated-clip'
    result.cameraClips = [clip]
  }

  return result
}

// ── Lane resolution (overlap prevention + ripple) ──────────────────────

export interface LaneClip {
  id: string
  start: number
  duration: number
}

export interface LaneResolution {
  /** id → new start time. Only includes clips whose position changed. */
  positions: Map<string, number>
  /** Possibly adjusted start for the dragged clip if left-cascade hit time 0. */
  constrainedStart: number
}

/**
 * Resolve overlaps on a single lane by pushing neighbors away from the
 * dragged clip. Clips are categorized by their center relative to the
 * dragged clip's center: those to the left are packed leftward, those to
 * the right are packed rightward. Cascading push is handled by walking
 * outward from the dragged clip.
 *
 * If the left-side cascade would push a clip below time 0, the dragged
 * clip is constrained rightward so the chain fits.
 */
export function resolveLane(
  laneClips: readonly LaneClip[],
  draggedId: string,
  draggedStart: number,
  draggedDuration: number,
): LaneResolution {
  const positions = new Map<string, number>()
  const others = laneClips.filter((c) => c.id !== draggedId)

  const draggedCenter = draggedStart + draggedDuration / 2
  const leftSide = others
    .filter((c) => c.start + c.duration / 2 < draggedCenter)
    .sort((a, b) => b.start - a.start)  // closest to dragged first
  const rightSide = others
    .filter((c) => c.start + c.duration / 2 >= draggedCenter)
    .sort((a, b) => a.start - b.start)  // closest to dragged first

  let constrainedStart = Math.max(0, draggedStart)

  // Pack left side: each leftClip's right edge ≤ rightLimit
  const packLeft = (leftEdge: number): { positions: Map<string, number>; minStart: number } => {
    const out = new Map<string, number>()
    let rightLimit = leftEdge
    let minStart = leftEdge
    for (const c of leftSide) {
      const cEnd = c.start + c.duration
      if (cEnd > rightLimit) {
        const newStart = rightLimit - c.duration
        out.set(c.id, newStart)
        rightLimit = newStart
        if (newStart < minStart) minStart = newStart
      } else {
        rightLimit = c.start
        if (c.start < minStart) minStart = c.start
      }
    }
    return { positions: out, minStart }
  }

  let leftPack = packLeft(constrainedStart)
  if (leftPack.minStart < 0) {
    // Constrain dragged clip rightward so leftmost left-clip lands at 0
    constrainedStart = constrainedStart + (0 - leftPack.minStart)
    leftPack = packLeft(constrainedStart)
  }
  for (const [id, start] of leftPack.positions) positions.set(id, start)

  // Pack right side: each rightClip's left edge ≥ leftLimit
  let leftLimit = constrainedStart + draggedDuration
  for (const c of rightSide) {
    if (c.start < leftLimit) {
      positions.set(c.id, leftLimit)
      leftLimit = leftLimit + c.duration
    } else {
      leftLimit = c.start + c.duration
    }
  }

  return { positions, constrainedStart }
}

/** Assign the lowest lane that doesn't overlap with existing items. */
export function assignLane(
  existing: readonly { time: number; duration: number; lane?: number }[],
  newStart: number,
  newDuration: number,
): number {
  for (let lane = 0; ; lane++) {
    const newEnd = newStart + newDuration
    const conflict = existing.some((item) => {
      if ((item.lane ?? 0) !== lane) return false
      const itemEnd = item.time + item.duration
      return newStart < itemEnd && newEnd > item.time
    })
    if (!conflict) return lane
  }
}

/** Ensure axisMarks exists on a loaded timeline (backward compat). */
export function ensureAxisMarks(dt: DirectorTimeline): DirectorTimeline & { axisMarks: Record<AxisMarkChannel, AxisMark[]> } {
  if (dt.axisMarks) return dt as DirectorTimeline & { axisMarks: Record<AxisMarkChannel, AxisMark[]> }
  return { ...dt, axisMarks: createDefaultAxisMarks() }
}

/** Returns true iff the clip set satisfies the zero-coverage invariant:
 *  either empty, or at least one clip has timelineStart === 0. */
export function hasZeroCoverage(clips: readonly { timelineStart: number }[]): boolean {
  return clips.length === 0 || clips.some((c) => c.timelineStart === 0)
}
