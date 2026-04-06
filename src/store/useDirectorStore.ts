// Director store — transient playback state for Director Timeline mode.
// Camera/event CRUD operates on Scene.directorTimeline via useSceneStore.

import { create } from 'zustand'
import { useSceneStore } from './useSceneStore'
import {
  createDefaultDirectorTimeline,
  createDefaultRails,
  createDefaultCamera,
  createDefaultAxisMarks,
  createDefaultCameraClip,
  findActiveClip,
  migrateDirectorTimeline,
  ensureAxisMarks,
  AXIS_MARK_IDX,
  RAIL_MIN_STUB,
  type CameraClip,
  type CameraMark,
  type CameraViewKeyframe,
  type EventMarker,
  type DirectorRails,
  type DirectorCameraSetup,
  type DirectorCamera,
  type TargetMode,
  type RailAxis,
  type RailDir,
  type RailHandleId,
  type AxisMark,
  type AxisMarkChannel,
} from '../animation/directorTypes'
import { nanoid } from '../utils/nanoid'
import type { AxisHover } from '../rendering/zTunnelOverlay'

interface DirectorStore {
  // Mode
  directorMode: boolean
  directorPlayheadTime: number
  directorPlaying: boolean
  playStartTime: number  // performance.now() epoch for elapsed calculation
  selectedCameraKeyframeId: string | null
  focalLengthMm: number  // focal length in mm for FOV control
  frustumSpotlightOn: boolean  // Q key frustum spotlight toggle
  viewfinderAspect: string     // e.g. '16:9', '4:3', '1:1', '9:16', '2.35:1'
  exporting: boolean           // true while video export is in progress

  // ── Director camera setup (rail UX, step 1) ──────────────────────────────
  // Separate from the viewport camera (orbit controls).
  // Represents the physical director camera object placed in the scene.
  directorCameraPos:      [number, number, number]
  directorTargetPos:      [number, number, number]
  selectedCameraId: string | null
  directorRails:          DirectorRails
  selectedRailHandle:     RailHandleId | null
  directorCameraAxisHover: AxisHover
  railWorldAnchor:         [number, number, number]  // world-fixed anchor for extended rails
  directorTargetAttachedTo: string | null             // element ID the target is attached to (null = free)
  directorTargetMode: TargetMode  // 'fixed' | 'locked'
  activeRailAxis: AxisMarkChannel | null               // currently selected rail axis for marking

  // Camera clip state
  detailClipId: string | null     // null=clip view, non-null=detail view
  selectedClipId: string | null   // selected clip in clip view
  activeClipId: string | null     // currently editing clip

  // Mode controls
  setDirectorMode: (on: boolean) => void
  setDirectorPlayheadTime: (ms: number) => void
  startPlaying: () => void
  stopPlaying: () => void
  setSelectedCameraKeyframeId: (id: string | null) => void
  setFocalLengthMm: (mm: number) => void
  toggleFrustumSpotlight: () => void
  setViewfinderAspect: (aspect: string) => void

  // Director camera setup actions
  setDirectorCameraPos:      (pos: [number, number, number]) => void
  setDirectorTargetPos:      (pos: [number, number, number]) => void
  // Multi-camera CRUD
  addCamera: () => string
  removeCamera: (id: string) => void
  selectCamera: (id: string | null) => void
  loadCameraSetup: (cameraId: string) => void
  setDirectorRails:          (rails: DirectorRails) => void
  setSelectedRailHandle:     (handle: RailHandleId | null) => void
  extendRail:                (axis: RailAxis, dir: RailDir, newExtent: number) => void
  toggleRailMode:            (axis: 'truck' | 'boom') => void
  setDirectorCameraAxisHover: (hover: AxisHover) => void
  setRailWorldAnchor:        (anchor: [number, number, number]) => void
  setDirectorTargetAttachedTo: (id: string | null) => void
  setDirectorTargetMode: (mode: TargetMode) => void
  toggleDirectorTargetMode: () => void
  alignCameraFront: () => void
  setActiveRailAxis: (axis: AxisMarkChannel | null) => void
  saveCameraSetup: () => void  // persist current camera rig to scene

  // Camera clip CRUD
  addCameraClip: () => string
  removeCameraClip: (id: string) => void
  updateCameraClip: (id: string, patch: Partial<CameraClip>) => void
  resizeCameraClip: (id: string, newDuration: number) => void
  moveCameraClip: (id: string, newStart: number) => void
  enterClipDetail: (clipId: string) => void
  exitClipDetail: () => void
  loadClipSetup: (clipId: string) => void
  saveClipSetup: () => void

  // Camera mark CRUD (operates on active scene)
  selectedCameraMarkId: string | null
  setSelectedCameraMarkId: (id: string | null) => void
  addCameraMark: (mark: CameraMark) => void
  updateCameraMark: (markId: string, patch: Partial<CameraMark>) => void
  removeCameraMark: (markId: string) => void

  // Camera keyframe CRUD (legacy, operates on active scene)
  addCameraKeyframe: (kf: CameraViewKeyframe) => void
  updateCameraKeyframe: (kfId: string, patch: Partial<CameraViewKeyframe>) => void
  removeCameraKeyframe: (kfId: string) => void

  // Event marker CRUD (operates on active scene)
  addEventMarker: (marker: EventMarker) => void
  updateEventMarker: (markerId: string, patch: Partial<EventMarker>) => void
  removeEventMarker: (markerId: string) => void

  // Rail timing (replaces per-axis marks)
  setRailTiming: (axis: AxisMarkChannel, startTime: number, endTime: number) => void
  setRailEasing: (axis: AxisMarkChannel, easing: import('../animation/types').EasingType | undefined) => void
  /** Set start or end time from current playhead: fills startTime first, then endTime. */
  stampRailTime: () => void

  // Per-axis mark CRUD (DEPRECATED — kept for backward compat during transition)
  selectedAxisMarkId: string | null
  selectedAxisMarkChannel: AxisMarkChannel | null
  addAxisMark: (mark: AxisMark) => void
  updateAxisMark: (channel: AxisMarkChannel, markId: string, patch: Partial<AxisMark>) => void
  removeAxisMark: (channel: AxisMarkChannel, markId: string) => void
  setSelectedAxisMark: (channel: AxisMarkChannel | null, id: string | null) => void
  markAxis: (channel: AxisMarkChannel) => void
  markActiveAxis: () => void

  // Shift all marks by a world-space delta (for rig movement)
  shiftAllMarks: (delta: [number, number, number]) => void

  // Full reset
  resetDirector: () => void
}

function updateActiveSceneDirectorTimeline(
  updater: (dt: ReturnType<typeof createDefaultDirectorTimeline>) => ReturnType<typeof createDefaultDirectorTimeline>,
) {
  const { scenes, activeSceneId } = useSceneStore.getState()
  useSceneStore.setState({
    scenes: scenes.map((s) =>
      s.id === activeSceneId
        ? { ...s, directorTimeline: updater(s.directorTimeline ?? createDefaultDirectorTimeline()) }
        : s,
    ),
  })
}

export const useDirectorStore = create<DirectorStore>((set, get) => ({
  directorMode: false,
  directorPlayheadTime: 0,
  directorPlaying: false,
  playStartTime: 0,
  selectedCameraKeyframeId: null,
  focalLengthMm: 38,
  frustumSpotlightOn: false,
  viewfinderAspect: '16:9',
  exporting: false,

  // Director camera setup defaults
  directorCameraPos:      [0, 0, 18],
  directorTargetPos:      [0, 0, 0],
  selectedCameraId: null,
  directorRails:          createDefaultRails(),
  selectedRailHandle:     null,
  directorCameraAxisHover: null,
  railWorldAnchor:         [0, 0, 18],
  directorTargetAttachedTo: null,
  directorTargetMode: 'fixed' as TargetMode,
  activeRailAxis: null,

  // Camera clip state defaults
  detailClipId: null,
  selectedClipId: null,
  activeClipId: null,

  setDirectorMode: (on) => {
    if (on) {
      // Ensure at least one camera exists in the scene
      const { scenes, activeSceneId } = useSceneStore.getState()
      const scene = scenes.find((s) => s.id === activeSceneId)
      let dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
      dt = migrateDirectorTimeline(dt)
      if ((dt.cameras ?? []).length === 0) {
        const cam = createDefaultCamera(nanoid())
        dt = { ...dt, cameras: [cam] }
      }
      updateActiveSceneDirectorTimeline(() => dt)
      const firstCamId = dt.cameras[0].id
      set({
        directorMode: true,
        directorPlaying: false,
        frustumSpotlightOn: false,
        selectedCameraId: firstCamId,
        selectedRailHandle: null,
      })
      get().loadCameraSetup(firstCamId)
    } else {
      get().saveCameraSetup()
      set({
        directorMode: false,
        directorPlaying: false,
        frustumSpotlightOn: false,
        selectedCameraId: null,
        selectedRailHandle: null,
      })
    }
  },
  setSelectedCameraKeyframeId: (id) => set({ selectedCameraKeyframeId: id }),
  setFocalLengthMm: (mm) => set({ focalLengthMm: Math.max(10, Math.min(200, mm)) }),
  toggleFrustumSpotlight: () => set((s) => ({ frustumSpotlightOn: !s.frustumSpotlightOn })),
  setViewfinderAspect: (aspect) => set({ viewfinderAspect: aspect }),

  setDirectorPlayheadTime: (ms) => set({ directorPlayheadTime: Math.max(0, ms) }),

  startPlaying: () => {
    const current = get().directorPlayheadTime
    set({
      directorPlaying: true,
      playStartTime: performance.now() - current,
    })
  },

  stopPlaying: () => set({ directorPlaying: false }),

  // ── Director camera setup actions ──

  setDirectorCameraPos: (pos) => set({ directorCameraPos: pos }),
  setDirectorTargetPos: (pos) => {
    const z = get().directorTargetAttachedTo ? pos[2] : Math.max(0, pos[2])
    set({ directorTargetPos: [pos[0], pos[1], z] })
  },

  // ── Multi-camera CRUD ──

  addCamera: () => {
    const s = get()
    // Save current camera before creating new one
    get().saveCameraSetup()

    const camId = nanoid()
    const { scenes, activeSceneId } = useSceneStore.getState()
    const scene = scenes.find((sc) => sc.id === activeSceneId)
    const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
    const camCount = (dt.cameras ?? []).length

    const cam = createDefaultCamera(camId)
    cam.name = `Camera ${camCount + 1}`

    updateActiveSceneDirectorTimeline((prev) => ({
      ...prev,
      cameras: [...(prev.cameras ?? []), cam],
    }))

    set({ selectedCameraId: camId })
    get().loadCameraSetup(camId)
    return camId
  },

  removeCamera: (id) => {
    const { scenes, activeSceneId } = useSceneStore.getState()
    const scene = scenes.find((sc) => sc.id === activeSceneId)
    const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
    const cameras = dt.cameras ?? []
    if (cameras.length <= 1) return  // minimum 1 camera

    updateActiveSceneDirectorTimeline((prev) => ({
      ...prev,
      cameras: (prev.cameras ?? []).filter((c) => c.id !== id),
      cameraClips: prev.cameraClips.filter((c) => c.cameraId !== id),
    }))

    const s = get()
    if (s.selectedCameraId === id) {
      const remaining = cameras.filter((c) => c.id !== id)
      if (remaining.length > 0) {
        set({ selectedCameraId: remaining[0].id })
        get().loadCameraSetup(remaining[0].id)
      } else {
        set({ selectedCameraId: null })
      }
    }
  },

  selectCamera: (id) => {
    const s = get()
    if (s.selectedCameraId === id) return
    // Save current camera before switching
    if (s.selectedCameraId) get().saveCameraSetup()
    if (id) {
      set({ selectedCameraId: id })
      get().loadCameraSetup(id)
    } else {
      set({ selectedCameraId: null })
    }
  },

  loadCameraSetup: (cameraId) => {
    const { scenes, activeSceneId } = useSceneStore.getState()
    const scene = scenes.find((sc) => sc.id === activeSceneId)
    const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
    const cam = (dt.cameras ?? []).find((c) => c.id === cameraId)
    if (!cam) return
    set({
      directorCameraPos: [...cam.setup.cameraPos],
      directorTargetPos: [...cam.setup.targetPos],
      directorRails: {
        ...cam.setup.rails,
        truck: { ...cam.setup.rails.truck },
        boom:  { ...cam.setup.rails.boom },
        dolly: { ...cam.setup.rails.dolly },
      },
      railWorldAnchor: [...cam.setup.railWorldAnchor],
      directorTargetAttachedTo: cam.setup.targetAttachedTo,
      directorTargetMode: cam.setup.targetMode ?? 'fixed',
      focalLengthMm: cam.focalLengthMm,
      viewfinderAspect: cam.viewfinderAspect,
    })
  },
  setDirectorRails: (rails) => set({ directorRails: rails }),
  setSelectedRailHandle: (handle) => set({ selectedRailHandle: handle }),

  extendRail: (axis, dir, newExtent) => {
    const extent = Math.max(RAIL_MIN_STUB, newExtent)
    const { directorRails, activeClipId } = get()
    if (axis === 'sphere') {
      set({ directorRails: { ...directorRails, sphere: extent } })
    } else {
      const oldExtent = directorRails[axis][dir]
      const isNewlyExtended = oldExtent <= RAIL_MIN_STUB + 0.001 && extent > RAIL_MIN_STUB + 0.001
      let timingPatch: Partial<import('../animation/directorTypes').RailExtents> = {}
      if (isNewlyExtended) {
        // Auto-set timing when rail transitions from stub to extended
        let clipDuration = 3000
        if (activeClipId) {
          const { scenes, activeSceneId } = useSceneStore.getState()
          const scene = scenes.find((sc) => sc.id === activeSceneId)
          const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
          const clip = dt.cameraClips.find((c) => c.id === activeClipId)
          if (clip) clipDuration = clip.duration
        }
        timingPatch = { startTime: 0, endTime: clipDuration }
      }
      set({
        directorRails: {
          ...directorRails,
          [axis]: { ...directorRails[axis], [dir]: extent, ...timingPatch },
        },
        // Auto-select the axis being extended for M key stamping
        activeRailAxis: axis as AxisMarkChannel,
      })
    }
  },

  setDirectorCameraAxisHover: (hover) => set({ directorCameraAxisHover: hover }),
  setRailWorldAnchor: (anchor) => set({ railWorldAnchor: anchor }),
  setDirectorTargetAttachedTo: (id) => set({ directorTargetAttachedTo: id }),
  setDirectorTargetMode: (mode) => set({ directorTargetMode: mode }),
  toggleDirectorTargetMode: () => set((s) => ({ directorTargetMode: s.directorTargetMode === 'fixed' ? 'locked' : 'fixed' })),

  alignCameraFront: () => {
    const s = get()
    const [cx, cy, cz] = s.directorCameraPos
    const [tx, ty, tz] = s.directorTargetPos
    const dx = cx - tx, dy = cy - ty, dz = cz - tz
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dist < 0.001) return
    const newCamPos: [number, number, number] = [tx, ty, tz + dist]
    const delta: [number, number, number] = [newCamPos[0] - cx, newCamPos[1] - cy, newCamPos[2] - cz]
    set({
      directorCameraPos: newCamPos,
      railWorldAnchor: [
        s.railWorldAnchor[0] + delta[0],
        s.railWorldAnchor[1] + delta[1],
        s.railWorldAnchor[2] + delta[2],
      ],
    })
    if (s.directorTargetMode === 'locked') {
      get().shiftAllMarks(delta)
    }
  },

  setActiveRailAxis: (axis) => set({ activeRailAxis: axis }),

  saveCameraSetup: () => {
    const s = get()
    // Route to saveClipSetup when editing a clip
    if (s.activeClipId) {
      get().saveClipSetup()
      return
    }
    if (!s.selectedCameraId) return
    const camId = s.selectedCameraId
    const setup: DirectorCameraSetup = {
      cameraPos: [...s.directorCameraPos],
      targetPos: [...s.directorTargetPos],
      rails: { ...s.directorRails },
      railWorldAnchor: [...s.railWorldAnchor],
      targetAttachedTo: s.directorTargetAttachedTo,
      targetMode: s.directorTargetMode,
    }
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameras: (dt.cameras ?? []).map((c) =>
        c.id === camId
          ? { ...c, setup, focalLengthMm: s.focalLengthMm, viewfinderAspect: s.viewfinderAspect }
          : c,
      ),
    }))
  },

  // ── Camera clip CRUD ──

  addCameraClip: () => {
    const s = get()
    const clipId = nanoid()
    const { scenes, activeSceneId } = useSceneStore.getState()
    const scene = scenes.find((sc) => sc.id === activeSceneId)
    const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
    const clipCount = dt.cameraClips.length

    const setup: DirectorCameraSetup = {
      cameraPos: [...s.directorCameraPos],
      targetPos: [...s.directorTargetPos],
      rails: {
        ...s.directorRails,
        truck: { ...s.directorRails.truck },
        boom:  { ...s.directorRails.boom },
        dolly: { ...s.directorRails.dolly },
      },
      railWorldAnchor: [...s.railWorldAnchor],
      targetAttachedTo: s.directorTargetAttachedTo,
      targetMode: s.directorTargetMode,
    }

    const clip = createDefaultCameraClip(setup, s.selectedCameraId ?? '')
    clip.id = clipId
    clip.name = `Camera ${clipCount + 1}`
    clip.timelineStart = s.directorPlayheadTime
    clip.focalLengthMm = s.focalLengthMm

    updateActiveSceneDirectorTimeline((prev) => ({
      ...prev,
      cameraClips: [...prev.cameraClips, clip],
    }))

    set({ selectedClipId: clipId, activeClipId: clipId })
    return clipId
  },

  removeCameraClip: (id) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraClips: dt.cameraClips.filter((c) => c.id !== id),
    }))
    const s = get()
    const patch: Partial<DirectorStore> = {}
    if (s.selectedClipId === id) patch.selectedClipId = null
    if (s.activeClipId === id) patch.activeClipId = null
    if (s.detailClipId === id) patch.detailClipId = null
    if (Object.keys(patch).length > 0) set(patch)
  },

  updateCameraClip: (id, patch) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraClips: dt.cameraClips.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    }))
  },

  resizeCameraClip: (id, newDuration) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraClips: dt.cameraClips.map((c) => {
        if (c.id !== id) return c
        const ratio = newDuration / c.duration
        const scaledRails: DirectorRails = {
          ...c.cameraSetup.rails,
          truck: {
            ...c.cameraSetup.rails.truck,
            startTime: c.cameraSetup.rails.truck.startTime * ratio,
            endTime: c.cameraSetup.rails.truck.endTime * ratio,
          },
          boom: {
            ...c.cameraSetup.rails.boom,
            startTime: c.cameraSetup.rails.boom.startTime * ratio,
            endTime: c.cameraSetup.rails.boom.endTime * ratio,
          },
          dolly: {
            ...c.cameraSetup.rails.dolly,
            startTime: c.cameraSetup.rails.dolly.startTime * ratio,
            endTime: c.cameraSetup.rails.dolly.endTime * ratio,
          },
        }
        return {
          ...c,
          duration: newDuration,
          cameraSetup: { ...c.cameraSetup, rails: scaledRails },
        }
      }),
    }))
  },

  moveCameraClip: (id, newStart) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraClips: dt.cameraClips.map((c) =>
        c.id === id ? { ...c, timelineStart: newStart } : c,
      ),
    }))
  },

  enterClipDetail: (clipId) => {
    const s = get()
    if (s.activeClipId) get().saveClipSetup()
    set({ detailClipId: clipId, activeClipId: clipId })
    get().loadClipSetup(clipId)
  },

  exitClipDetail: () => {
    get().saveClipSetup()
    set({ detailClipId: null })
  },

  loadClipSetup: (clipId) => {
    const { scenes, activeSceneId } = useSceneStore.getState()
    const scene = scenes.find((sc) => sc.id === activeSceneId)
    const dt = scene?.directorTimeline ?? createDefaultDirectorTimeline()
    const clip = dt.cameraClips.find((c) => c.id === clipId)
    if (!clip) return

    set({
      directorCameraPos: [...clip.cameraSetup.cameraPos],
      directorTargetPos: [...clip.cameraSetup.targetPos],
      directorRails: {
        ...clip.cameraSetup.rails,
        truck: { ...clip.cameraSetup.rails.truck },
        boom:  { ...clip.cameraSetup.rails.boom },
        dolly: { ...clip.cameraSetup.rails.dolly },
      },
      railWorldAnchor: [...clip.cameraSetup.railWorldAnchor],
      directorTargetAttachedTo: clip.cameraSetup.targetAttachedTo,
      directorTargetMode: clip.cameraSetup.targetMode ?? 'fixed',
      focalLengthMm: clip.focalLengthMm,
      activeClipId: clipId,
    })
  },

  saveClipSetup: () => {
    const s = get()
    if (!s.activeClipId) return
    const activeId = s.activeClipId
    const setup: DirectorCameraSetup = {
      cameraPos: [...s.directorCameraPos],
      targetPos: [...s.directorTargetPos],
      rails: {
        ...s.directorRails,
        truck: { ...s.directorRails.truck },
        boom:  { ...s.directorRails.boom },
        dolly: { ...s.directorRails.dolly },
      },
      railWorldAnchor: [...s.railWorldAnchor],
      targetAttachedTo: s.directorTargetAttachedTo,
      targetMode: s.directorTargetMode,
    }
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraClips: dt.cameraClips.map((c) =>
        c.id === activeId
          ? { ...c, cameraSetup: setup, focalLengthMm: s.focalLengthMm }
          : c,
      ),
    }))
  },

  // ── Camera mark CRUD ──

  selectedCameraMarkId: null,
  setSelectedCameraMarkId: (id) => set({ selectedCameraMarkId: id }),

  addCameraMark: (mark) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraMarks: [...(dt.cameraMarks ?? []), mark].sort((a, b) => a.time - b.time),
    }))
  },

  updateCameraMark: (markId, patch) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraMarks: (dt.cameraMarks ?? [])
        .map((m) => (m.id === markId ? { ...m, ...patch } : m))
        .sort((a, b) => a.time - b.time),
    }))
  },

  removeCameraMark: (markId) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraMarks: (dt.cameraMarks ?? []).filter((m) => m.id !== markId),
    }))
  },

  toggleRailMode: (axis) => {
    const { directorRails } = get()
    const key = axis === 'truck' ? 'truckMode' : 'boomMode'
    const current = directorRails[key]
    set({
      directorRails: {
        ...directorRails,
        [key]: current === 'linear' ? 'circular' : 'linear',
      },
    })
  },

  // ── Camera keyframe CRUD ──

  addCameraKeyframe: (kf) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraKeyframes: [...dt.cameraKeyframes, kf].sort((a, b) => a.time - b.time),
    }))
  },

  updateCameraKeyframe: (kfId, patch) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraKeyframes: dt.cameraKeyframes
        .map((k) => (k.id === kfId ? { ...k, ...patch } : k))
        .sort((a, b) => a.time - b.time),
    }))
  },

  removeCameraKeyframe: (kfId) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      cameraKeyframes: dt.cameraKeyframes.filter((k) => k.id !== kfId),
    }))
  },

  // ── Event marker CRUD ──

  addEventMarker: (marker) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      eventMarkers: [...dt.eventMarkers, marker].sort((a, b) => a.time - b.time),
    }))
  },

  updateEventMarker: (markerId, patch) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      eventMarkers: dt.eventMarkers
        .map((m) => (m.id === markerId ? { ...m, ...patch } : m))
        .sort((a, b) => a.time - b.time),
    }))
  },

  removeEventMarker: (markerId) => {
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      eventMarkers: dt.eventMarkers.filter((m) => m.id !== markerId),
    }))
  },

  // ── Per-axis mark CRUD ──

  selectedAxisMarkId: null,
  selectedAxisMarkChannel: null,
  setSelectedAxisMark: (channel, id) => set({ selectedAxisMarkChannel: channel, selectedAxisMarkId: id }),

  addAxisMark: (mark) => {
    updateActiveSceneDirectorTimeline((dt) => {
      const e = ensureAxisMarks(dt)
      return {
        ...e,
        axisMarks: {
          ...e.axisMarks,
          [mark.channel]: [...e.axisMarks[mark.channel], mark].sort((a, b) => a.time - b.time),
        },
      }
    })
  },

  updateAxisMark: (channel, markId, patch) => {
    updateActiveSceneDirectorTimeline((dt) => {
      const e = ensureAxisMarks(dt)
      return {
        ...e,
        axisMarks: {
          ...e.axisMarks,
          [channel]: e.axisMarks[channel]
            .map((m) => (m.id === markId ? { ...m, ...patch } : m))
            .sort((a, b) => a.time - b.time),
        },
      }
    })
  },

  removeAxisMark: (channel, markId) => {
    updateActiveSceneDirectorTimeline((dt) => {
      const e = ensureAxisMarks(dt)
      return {
        ...e,
        axisMarks: {
          ...e.axisMarks,
          [channel]: e.axisMarks[channel].filter((m) => m.id !== markId),
        },
      }
    })
  },

  markAxis: (channel) => {
    const s = get()
    const idx = AXIS_MARK_IDX[channel]
    const value = s.directorCameraPos[idx] - s.railWorldAnchor[idx]
    const mark: AxisMark = {
      id: nanoid(),
      channel,
      time: Math.round(s.directorPlayheadTime),
      value,
    }
    get().addAxisMark(mark)
  },

  markActiveAxis: () => {
    const s = get()
    if (!s.activeRailAxis) return
    get().markAxis(s.activeRailAxis)
  },

  // ── Rail timing actions ──

  setRailTiming: (axis, startTime, endTime) => {
    const { directorRails } = get()
    const ext = directorRails[axis]
    set({
      directorRails: {
        ...directorRails,
        [axis]: { ...ext, startTime, endTime },
      },
    })
  },

  setRailEasing: (axis, easing) => {
    const { directorRails } = get()
    const ext = directorRails[axis]
    set({
      directorRails: {
        ...directorRails,
        [axis]: { ...ext, easing },
      },
    })
  },

  stampRailTime: () => {
    const s = get()
    if (!s.activeRailAxis) return
    const axis = s.activeRailAxis
    const ext = s.directorRails[axis]
    const time = Math.round(s.directorPlayheadTime)
    if (ext.startTime === 0 && ext.endTime === 0) {
      get().setRailTiming(axis, time, 0)
    } else if (ext.endTime === 0) {
      get().setRailTiming(axis, ext.startTime, time)
    } else {
      get().setRailTiming(axis, ext.startTime, time)
    }
  },

  shiftAllMarks: (delta) => {
    const [dx, dy, dz] = delta
    if (dx === 0 && dy === 0 && dz === 0) return
    updateActiveSceneDirectorTimeline((dt) => ({
      ...dt,
      // cameraMarks store absolute positions — shift them
      cameraMarks: (dt.cameraMarks ?? []).map((m) => ({
        ...m,
        position: [m.position[0] + dx, m.position[1] + dy, m.position[2] + dz] as [number, number, number],
        target: [m.target[0] + dx, m.target[1] + dy, m.target[2] + dz] as [number, number, number],
      })),
      // axisMarks store offsets relative to railWorldAnchor — do NOT shift
      // (anchor itself moves, so playback auto-adjusts via basePos + offset)
    }))
  },

  resetDirector: () => {
    set({
      directorPlayheadTime: 0,
      directorPlaying: false,
      playStartTime: 0,
      selectedCameraKeyframeId: null,
      focalLengthMm: 38,
      frustumSpotlightOn: false,
      viewfinderAspect: '16:9',
      directorCameraPos: [0, 0, 18],
      directorTargetPos: [0, 0, 0],
      selectedCameraId: null,
      directorRails: createDefaultRails(),
      selectedRailHandle: null,
      directorCameraAxisHover: null,
      railWorldAnchor: [0, 0, 18],
      directorTargetAttachedTo: null,
      directorTargetMode: 'fixed' as TargetMode,
      selectedCameraMarkId: null,
      selectedAxisMarkId: null,
      selectedAxisMarkChannel: null,
      activeRailAxis: null,
      detailClipId: null,
      selectedClipId: null,
      activeClipId: null,
    })
    updateActiveSceneDirectorTimeline(() => createDefaultDirectorTimeline())
  },
}))

// Auto-persist camera setup to scene when rig state changes (debounced)
let _saveTimer: ReturnType<typeof setTimeout> | null = null
let _prevKey = ''
useDirectorStore.subscribe((s) => {
  if (!s.directorMode) return
  const key = `${s.directorCameraPos}|${s.directorTargetPos}|${s.directorRails.truck.neg},${s.directorRails.truck.pos},${s.directorRails.boom.neg},${s.directorRails.boom.pos},${s.directorRails.dolly.neg},${s.directorRails.dolly.pos}|${s.railWorldAnchor}|${s.directorTargetAttachedTo}`
  if (key === _prevKey) return
  _prevKey = key
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => useDirectorStore.getState().saveCameraSetup(), 300)
})
