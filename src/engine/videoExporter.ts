// Video exporter — captures WebGL canvas frames as WebM video.
// Uses MediaRecorder + canvas.captureStream() with manual frame control.
//
// Does NOT import React or Zustand (engine layer).

export interface VideoExportOptions {
  width: number
  height: number
  fps: number
  duration: number  // ms, total animation duration
}

export interface VideoExporter {
  start(options: VideoExportOptions): Promise<Blob>
  cancel(): void
  readonly progress: number
  onProgress: ((progress: number) => void) | null
}

export function createVideoExporter(
  canvas: HTMLCanvasElement,
  resizeFn: (w: number, h: number) => void,
  renderFrameFn: (timeMs: number) => void,
): VideoExporter {
  let cancelled = false
  let currentProgress = 0
  let onProgress: ((p: number) => void) | null = null

  async function start(opts: VideoExportOptions): Promise<Blob> {
    cancelled = false
    currentProgress = 0

    // Save original dimensions
    const origW = canvas.clientWidth
    const origH = canvas.clientHeight

    // Resize to export resolution
    resizeFn(opts.width, opts.height)

    // Force canvas pixel dimensions to match export resolution
    canvas.width = opts.width
    canvas.height = opts.height

    // Set up capture stream with manual frame requests
    const stream = canvas.captureStream(0)
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: getSupportedMimeType(),
      videoBitsPerSecond: 8_000_000,
    })

    const chunks: Blob[] = []
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    const done = new Promise<Blob>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        if (cancelled) {
          reject(new Error('Export cancelled'))
        } else {
          resolve(new Blob(chunks, { type: 'video/webm' }))
        }
      }
      mediaRecorder.onerror = () => reject(new Error('MediaRecorder error'))
    })

    mediaRecorder.start()

    const totalFrames = Math.ceil(opts.duration / 1000 * opts.fps)
    const frameDuration = 1000 / opts.fps

    for (let frame = 0; frame < totalFrames; frame++) {
      if (cancelled) break

      const time = frame * frameDuration
      currentProgress = frame / totalFrames
      onProgress?.(currentProgress)

      // Render one frame at this time
      renderFrameFn(time)

      // Request frame capture from the stream
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack && 'requestFrame' in videoTrack) {
        (videoTrack as MediaStreamTrack & { requestFrame(): void }).requestFrame()
      }

      // Yield to browser to process the frame
      await new Promise((r) => setTimeout(r, 0))
    }

    currentProgress = 1
    onProgress?.(1)

    mediaRecorder.stop()

    // Restore original size
    resizeFn(origW, origH)

    return done
  }

  function cancel() {
    cancelled = true
  }

  return {
    start,
    cancel,
    get progress() { return currentProgress },
    get onProgress() { return onProgress },
    set onProgress(cb: ((p: number) => void) | null) { onProgress = cb },
  }
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return 'video/webm'
}
