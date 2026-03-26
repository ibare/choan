// Video export dialog — settings + progress for WebM export.

import { useState } from 'react'
import { Dialog } from '../components/ui/Dialog'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'

interface VideoExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (settings: VideoExportSettings) => void
  exporting: boolean
  progress: number
  duration: number  // ms, from active bundle
}

export interface VideoExportSettings {
  width: number
  height: number
  fps: number
}

const RESOLUTION_OPTIONS = [
  { value: '1280x720', label: '720p (1280x720)' },
  { value: '1920x1080', label: '1080p (1920x1080)' },
]

const FPS_OPTIONS = [
  { value: '24', label: '24 fps' },
  { value: '30', label: '30 fps' },
  { value: '60', label: '60 fps' },
]

export default function VideoExportDialog({
  open, onOpenChange, onExport, exporting, progress, duration,
}: VideoExportDialogProps) {
  const [resolution, setResolution] = useState('1280x720')
  const [fps, setFps] = useState('30')

  const handleExport = () => {
    const [w, h] = resolution.split('x').map(Number)
    onExport({ width: w, height: h, fps: Number(fps) })
  }

  const durationSec = (duration / 1000).toFixed(1)
  const progressPct = Math.round(progress * 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="ui-export-dialog">
      <div className="ui-export-dialog__title">Export Video</div>

      {exporting ? (
        <div className="ui-export-dialog__progress">
          <div className="ui-export-dialog__bar">
            <div className="ui-export-dialog__fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="ui-export-dialog__pct">{progressPct}%</span>
        </div>
      ) : (
        <>
          <div className="ui-export-dialog__row">
            <span className="ui-export-dialog__label">Resolution</span>
            <Select options={RESOLUTION_OPTIONS} value={resolution} onChange={setResolution} size="sm" />
          </div>
          <div className="ui-export-dialog__row">
            <span className="ui-export-dialog__label">Frame rate</span>
            <Select options={FPS_OPTIONS} value={fps} onChange={setFps} size="sm" />
          </div>
          <div className="ui-export-dialog__row">
            <span className="ui-export-dialog__label">Duration</span>
            <span className="ui-export-dialog__value">{durationSec}s</span>
          </div>
          <div className="ui-export-dialog__actions">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleExport}>Export WebM</Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
