// Director store — transient playback state for Director Timeline mode.
// Camera/event CRUD operates on Scene.directorTimeline via useSceneStore.

import { create } from 'zustand'
import { useSceneStore } from './useSceneStore'
import {
  createDefaultDirectorTimeline,
  createDefaultRails,
  type CameraViewKeyframe,
  type EventMarker,
  type DirectorRails,
  type RailAxis,
  type RailDir,
  type RailHandleId,
  RAIL_MIN_STUB,
} from '../animation/directorTypes'
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

  // Camera keyframe CRUD (operates on active scene)
  addCameraKeyframe: (kf: CameraViewKeyframe) => void
  updateCameraKeyframe: (kfId: string, patch: Partial<CameraViewKeyframe>) => void
  removeCameraKeyframe: (kfId: string) => void

  // Event marker CRUD (operates on active scene)
  addEventMarker: (marker: EventMarker) => void
  updateEventMarker: (markerId: string, patch: Partial<EventMarker>) => void
  removeEventMarker: (markerId: string) => void
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
  directorCameraPos:      [0, 3, 8],
  directorTargetPos:      [0, 0, 0],
  directorCameraSelected: false,
  directorRails:          createDefaultRails(),
  selectedRailHandle:     null,
  directorCameraAxisHover: null,
  railWorldAnchor:         [0, 3, 8],

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
      })
    }
  },

  setDirectorCameraAxisHover: (hover) => set({ directorCameraAxisHover: hover }),
  setRailWorldAnchor: (anchor) => set({ railWorldAnchor: anchor }),

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
}))
