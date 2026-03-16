import { useRef, useState } from 'react'
import SDFCanvas from './canvas/SDFCanvas'
import PropertiesPanel from './panels/PropertiesPanel'
import StatePanel from './panels/StatePanel'
import TimelinePanel from './panels/TimelinePanel'
import { useChoanStore } from './store/useChoanStore'
import { toMarkdown } from './export/toMarkdown'
import { serialize, deserialize } from './export/toYaml'
import type { DeserializedFile } from './export/toYaml'

export default function App() {
  const { elements, globalStates, interactions, loadFile, reset } = useChoanStore()
  const [projectName, setProjectName] = useState('My UI')
  const [exportMsg, setExportMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    const md = toMarkdown(elements, globalStates, interactions)
    try {
      await navigator.clipboard.writeText(md)
      setExportMsg('클립보드에 복사됨!')
    } catch {
      setExportMsg('복사 실패')
    }
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName}.md`
    a.click()
    URL.revokeObjectURL(url)
    setTimeout(() => setExportMsg(''), 3000)
  }

  const handleSave = () => {
    const content = serialize(projectName, elements, globalStates, interactions)
    const blob = new Blob([content], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName}.choan`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const result: DeserializedFile = deserialize(ev.target?.result as string)
        setProjectName(result.name)
        loadFile({
          elements: result.elements,
          globalStates: result.globalStates,
          interactions: result.interactions,
        })
      } catch (err) {
        alert('파일을 불러올 수 없습니다.')
        console.error(err)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="app">
      <div className="toolbar">
        <span className="app-logo">초안</span>
        <input
          className="project-name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        />
        <div className="toolbar-spacer" />
        <div className="action-group">
          <button className="btn" onClick={() => fileInputRef.current?.click()}>Open</button>
          <button className="btn" onClick={handleSave}>Save</button>
          <button className="btn btn-primary" onClick={handleExport}>Export MD</button>
          <button className="btn btn-ghost" onClick={() => { if (confirm('초기화할까요?')) reset() }}>Reset</button>
        </div>
        {exportMsg && <span className="export-msg">{exportMsg}</span>}
      </div>

      <div className="main">
        <div className="main-center">
          <div className="canvas-area">
            <SDFCanvas />
          </div>
          <TimelinePanel visible />
        </div>
        <div className="right-panel">
          <PropertiesPanel />
          <div className="panel-divider" />
          <StatePanel />
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".choan"
        style={{ display: 'none' }}
        onChange={handleOpen}
      />
    </div>
  )
}
