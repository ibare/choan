// Video export dialog — settings + progress for WebM export.

import { useState, useEffect } from 'react'
import { Dialog } from '../components/ui/Dialog'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

interface VideoExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onExport: (settings: VideoExportSettings) => void
  exporting: boolean
  progress: number
  duration: number  // ms, from active bundle (default value)
}

export interface VideoExportSettings {
  width: number
  height: number
  fps: number
  duration: number  // ms
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
  const [durationSec, setDurationSec] = useState('3.0')

  // Sync duration input when dialog opens or default duration changes
  useEffect(() => {
    if (open) setDurationSec((duration / 1000).toFixed(1))
  }, [open, duration])

  const handleExport = () => {
    const [w, h] = resolution.split('x').map(Number)
    const dur = Math.max(0.1, parseFloat(durationSec) || 1) * 1000
    onExport({ width: w, height: h, fps: Number(fps), duration: dur })
  }

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
            <span className="ui-export-dialog__label">Duration (sec)</span>
            <Input
              className="ui-export-dialog__duration-input"
              type="number"
              min="0.1"
              step="0.5"
              value={durationSec}
              onChange={(e) => setDurationSec(e.target.value)}
            />
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
