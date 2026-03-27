// Director store — transient playback state for Director Timeline mode.
// Camera/event CRUD operates on Scene.directorTimeline via useSceneStore.

import { create } from 'zustand'
import { useSceneStore } from './useSceneStore'
import { createDefaultDirectorTimeline, type CameraViewKeyframe, type EventMarker } from '../animation/directorTypes'

interface DirectorStore {
  // Mode
  directorMode: boolean
  directorPlayheadTime: number
  directorPlaying: boolean
  playStartTime: number  // performance.now() epoch for elapsed calculation

  // Mode controls
  setDirectorMode: (on: boolean) => void
  setDirectorPlayheadTime: (ms: number) => void
  startPlaying: () => void
  stopPlaying: () => void

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

  setDirectorMode: (on) => set({ directorMode: on, directorPlaying: false }),

  setDirectorPlayheadTime: (ms) => set({ directorPlayheadTime: Math.max(0, ms) }),

  startPlaying: () => {
    const current = get().directorPlayheadTime
    set({
      directorPlaying: true,
      playStartTime: performance.now() - current,
    })
  },

  stopPlaying: () => set({ directorPlaying: false }),

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
