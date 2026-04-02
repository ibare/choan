// Director store — transient playback state for Director Timeline mode.
// Camera/event CRUD operates on Scene.directorTimeline via useSceneStore.

import { create } from 'zustand'
import { useSceneStore } from './useSceneStore'
import {
  createDefaultDirectorTimeline,
  createDefaultRails,
  createDefaultAxisMarks,
  ensureAxisMarks,
  AXIS_MARK_IDX,
  type CameraMark,
  type CameraViewKeyframe,
  type EventMarker,
  type DirectorRails,
  type DirectorCameraSetup,
  type RailAxis,
  type RailDir,
  type RailHandleId,
  type AxisMark,
  type AxisMarkChannel,
  RAIL_MIN_STUB,
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

  // ── Director camera setup (rail UX, step 1) ──────────────────────────────
  // Separate from the viewport camera (orbit controls).
  // Represents the physical director camera object placed in the scene.
  directorCameraPos:      [number, number, number]
  directorTargetPos:      [number, number, number]
  directorCameraSelected: boolean
  directorRails:          DirectorRails
  selectedRailHandle:     RailHandleId | null
  directorCameraAxisHover: AxisHover
  railWorldAnchor:         [number, number, number]  // world-fixed anchor for extended rails
  directorTargetAttachedTo: string | null             // element ID the target is attached to (null = free)
  activeRailAxis: AxisMarkChannel | null               // currently selected rail axis for marking

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
  setDirectorCameraSelected: (selected: boolean) => void
  setDirectorRails:          (rails: DirectorRails) => void
  setSelectedRailHandle:     (handle: RailHandleId | null) => void
  extendRail:                (axis: RailAxis, dir: RailDir, newExtent: number) => void
  toggleRailMode:            (axis: 'truck' | 'boom') => void
  setDirectorCameraAxisHover: (hover: AxisHover) => void
  setRailWorldAnchor:        (anchor: [number, number, number]) => void
  setDirectorTargetAttachedTo: (id: string | null) => void
  setActiveRailAxis: (axis: AxisMarkChannel | null) => void
  saveCameraSetup: () => void  // persist current camera rig to scene

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

  // Director camera setup defaults
  directorCameraPos:      [0, 0, 18],
  directorTargetPos:      [0, 0, 0],
  directorCameraSelected: false,
  directorRails:          createDefaultRails(),
  selectedRailHandle:     null,
  directorCameraAxisHover: null,
  railWorldAnchor:         [0, 0, 18],
  directorTargetAttachedTo: null,
  activeRailAxis: null,

  setDirectorMode: (on) => set({
    directorMode: on,
    directorPlaying: false,
    frustumSpotlightOn: false,
    directorCameraSelected: false,
    selectedRailHandle: null,
  }),
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
  setDirectorTargetPos: (pos) => set({ directorTargetPos: pos }),
  setDirectorCameraSelected: (selected) => set({ directorCameraSelected: selected }),
  setDirectorRails: (rails) => set({ directorRails: rails }),
  setSelectedRailHandle: (handle) => set({ selectedRailHandle: handle }),

  extendRail: (axis, dir, newExtent) => {
    const extent = Math.max(RAIL_MIN_STUB, newExtent)
    const { directorRails } = get()
    if (axis === 'sphere') {
      set({ directorRails: { ...directorRails, sphere: extent } })
    } else {
      set({
        directorRails: {
          ...directorRails,
          [axis]: { ...directorRails[axis], [dir]: extent },
        },
        // Auto-select the axis being extended for M key stamping
        activeRailAxis: axis as AxisMarkChannel,
      })
    }
  },

  setDirectorCameraAxisHover: (hover) => set({ directorCameraAxisHover: hover }),
  setRailWorldAnchor: (anchor) => set({ railWorldAnchor: anchor }),
  setDirectorTargetAttachedTo: (id) => set({ directorTargetAttachedTo: id }),
  setActiveRailAxis: (axis) => set({ activeRailAxis: axis }),

  saveCameraSetup: () => {
    const s = get()
    const setup: DirectorCameraSetup = {
      cameraPos: [...s.directorCameraPos],
      targetPos: [...s.directorTargetPos],
      rails: { ...s.directorRails },
      railWorldAnchor: [...s.railWorldAnchor],
      targetAttachedTo: s.directorTargetAttachedTo,
    }
    updateActiveSceneDirectorTimeline((dt) => ({ ...dt, cameraSetup: setup }))
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
      directorCameraSelected: false,
      directorRails: createDefaultRails(),
      selectedRailHandle: null,
      directorCameraAxisHover: null,
      railWorldAnchor: [0, 0, 18],
      directorTargetAttachedTo: null,
      selectedCameraMarkId: null,
      selectedAxisMarkId: null,
      selectedAxisMarkChannel: null,
      activeRailAxis: null,
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
