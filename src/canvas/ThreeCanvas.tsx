import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { computeStrokePath } from './drawing'
import { snapDrawing } from './snap'
import { createElementMesh, PALETTE } from './materials'

type InputPoint = [number, number] | [number, number, number]
import { useChoanStore } from '../store/useChoanStore'
import type { ChoanElement } from '../store/useChoanStore'
import { nanoid } from './nanoid'

const FRUSTUM = 10

interface MeshRecord {
  id: string
  group: THREE.Group
  color: number
}

export default function ThreeCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraOrthoRef = useRef<THREE.OrthographicCamera | null>(null)
  const cameraPerspRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const frameRef = useRef<number>(0)
  const meshMapRef = useRef<Map<string, MeshRecord>>(new Map())
  const canvasSizeRef = useRef({ w: 1, h: 1 })
  const isPointerDownRef = useRef(false)
  const pointerStartRef = useRef<[number, number]>([0, 0])
  const isDraggingRef = useRef(false)
  const currentPointsRef = useRef<InputPoint[]>([])
  const svgOverlayRef = useRef<SVGSVGElement | null>(null)
  const [drawPath, setDrawPath] = useState('')

  const CLICK_THRESHOLD = 8 // px 이동 이하 → 클릭(선택), 이상 → 드래그(그리기)

  const {
    elements,
    selectedId,
    tool,
    isZViewMode,
    setTool,
    addElement,
    selectElement,
    removeElement,
  } = useChoanStore()

  // animate 클로저에서 최신 값을 읽기 위해 init effect 전에 선언
  const isZViewRef = useRef(isZViewMode)
  useEffect(() => { isZViewRef.current = isZViewMode }, [isZViewMode])

  // Three.js 초기화
  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current
    const w = mount.clientWidth
    const h = mount.clientHeight
    canvasSizeRef.current = { w, h }

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf7f3ee)
    sceneRef.current = scene

    // 격자 helper
    const grid = new THREE.GridHelper(20, 40, 0xd4c9bc, 0xe8e0d8)
    grid.rotation.x = Math.PI / 2
    scene.add(grid)

    // 조명 (ToonMaterial은 directional light 필요)
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(5, 10, 5)
    scene.add(dirLight)

    // OrthographicCamera
    const aspect = w / h
    const ortho = new THREE.OrthographicCamera(
      -FRUSTUM * aspect,
      FRUSTUM * aspect,
      FRUSTUM,
      -FRUSTUM,
      0.1,
      1000
    )
    ortho.position.set(0, 0, 10)
    cameraOrthoRef.current = ortho

    // PerspectiveCamera
    const persp = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000)
    persp.position.set(0, -3, 8)
    cameraPerspRef.current = persp

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(w, h)
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // OrbitControls (Z-view 전용)
    const controls = new OrbitControls(persp, renderer.domElement)
    controls.enabled = false
    controlsRef.current = controls

    // 렌더 루프 — isZViewRef.current 로 최신 상태 읽기 (클로저 stale 방지)
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      const zview = isZViewRef.current
      const cam = zview ? persp : ortho
      if (zview) controls.update()
      renderer.render(scene, cam)
    }
    animate()

    // 리사이즈
    const onResize = () => {
      const nw = mount.clientWidth
      const nh = mount.clientHeight
      canvasSizeRef.current = { w: nw, h: nh }
      renderer.setSize(nw, nh)
      const asp = nw / nh
      ortho.left = -FRUSTUM * asp
      ortho.right = FRUSTUM * asp
      ortho.updateProjectionMatrix()
      persp.aspect = asp
      persp.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Z뷰 모드 전환
  useEffect(() => {
    if (!controlsRef.current) return
    controlsRef.current.enabled = isZViewMode
  }, [isZViewMode])

  // elements → Three.js 메쉬 동기화
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const meshMap = meshMapRef.current
    const currentIds = new Set(elements.map((e) => e.id))

    // 삭제된 요소 제거
    for (const [id, rec] of meshMap) {
      if (!currentIds.has(id)) {
        scene.remove(rec.group)
        meshMap.delete(id)
      }
    }

    // 추가/업데이트
    for (const el of elements) {
      const { w, h } = canvasSizeRef.current
      const aspect = w / h
      // 픽셀 → 월드 좌표: 캔버스 좌상단(0,0)이 월드(-frustum*aspect, frustum)에 대응
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const wx = -FRUSTUM * aspect + (cx / w) * 2 * FRUSTUM * aspect
      const wy = FRUSTUM - (cy / h) * 2 * FRUSTUM
      const ww = (el.width / w) * 2 * FRUSTUM * aspect
      const wh = (el.height / h) * 2 * FRUSTUM

      if (meshMap.has(el.id)) {
        // 위치/크기 업데이트
        const rec = meshMap.get(el.id)!
        rec.group.position.set(wx, wy, el.z * 0.1)
        rec.group.scale.set(ww, wh, 1)
        // 선택 강조
        const mainMesh = rec.group.children[1] as THREE.Mesh
        mainMesh.material = new THREE.MeshToonMaterial({
          color: rec.color,
          opacity: el.opacity,
          transparent: el.opacity < 1,
          wireframe: selectedId === el.id,
        })
      } else {
        // 새 메쉬 생성
        const color = PALETTE[meshMap.size % PALETTE.length]
        let group: THREE.Group

        if (el.type === 'circle') {
          const geo = new THREE.CircleGeometry(0.5, 32)
          group = createElementMesh(geo, color)
        } else if (el.type === 'line') {
          const geo = new THREE.PlaneGeometry(1, 0.05)
          group = createElementMesh(geo, color)
        } else {
          const geo = new THREE.PlaneGeometry(1, 1)
          group = createElementMesh(geo, color)
        }

        group.position.set(wx, wy, el.z * 0.1)
        group.scale.set(ww, wh, 1)
        scene.add(group)
        meshMap.set(el.id, { id: el.id, group, color })
      }
    }
  }, [elements, selectedId])

  // 레이캐스트로 요소 히트 테스트
  const raycastElement = useCallback(
    (clientX: number, clientY: number): string | null => {
      const mount = mountRef.current
      const ortho = cameraOrthoRef.current
      if (!mount || !ortho) return null

      const rect = mount.getBoundingClientRect()
      const ndcX = ((clientX - rect.left) / mount.clientWidth) * 2 - 1
      const ndcY = -((clientY - rect.top) / mount.clientHeight) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), ortho)

      const meshObjects: THREE.Object3D[] = []
      for (const rec of meshMapRef.current.values()) {
        rec.group.traverse((obj) => { if ((obj as THREE.Mesh).isMesh) meshObjects.push(obj) })
      }

      const hits = raycaster.intersectObjects(meshObjects, false)
      if (hits.length === 0) return null

      const hitObj = hits[0].object
      for (const [id, rec] of meshMapRef.current) {
        if (rec.group === hitObj.parent || rec.group === hitObj.parent?.parent) {
          return id
        }
      }
      return null
    },
    []
  )

  // Select 모드: 클릭으로 선택/해제
  // Draw 모드: 드래그로 프리핸드 드로잉 → 스냅
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isZViewMode) return
      if (tool === 'select') {
        // 클릭 즉시 레이캐스트
        const hitId = raycastElement(e.clientX, e.clientY)
        selectElement(hitId)
        return
      }
      // draw 모드
      isPointerDownRef.current = true
      const ox = e.nativeEvent.offsetX
      const oy = e.nativeEvent.offsetY
      currentPointsRef.current = [[ox, oy, e.pressure]]
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [isZViewMode, tool, raycastElement, selectElement]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPointerDownRef.current || tool !== 'draw') return
      const ox = e.nativeEvent.offsetX
      const oy = e.nativeEvent.offsetY
      currentPointsRef.current = [
        ...currentPointsRef.current,
        [ox, oy, e.pressure],
      ]
      setDrawPath(computeStrokePath(currentPointsRef.current))
    },
    [tool]
  )

  const handlePointerUp = useCallback(() => {
    if (!isPointerDownRef.current || tool !== 'draw') return
    isPointerDownRef.current = false
    const points = currentPointsRef.current
    currentPointsRef.current = []
    setDrawPath('')

    if (points.length < 3) return

    const result = snapDrawing(points)
    if (result.width < 5 && result.height < 5) return

    const id = nanoid()
    const el: ChoanElement = {
      id,
      type: result.type,
      label: result.type === 'rectangle' ? 'Box' : result.type === 'circle' ? 'Circle' : 'Line',
      role: result.type === 'rectangle' ? 'container' : undefined,
      x: result.x,
      y: result.y,
      z: 0,
      width: result.width,
      height: result.height,
      opacity: 1,
      lineStyle: result.lineStyle,
      lineDirection: result.lineDirection,
    }
    addElement(el)
    selectElement(id)
  }, [tool, addElement, selectElement])

  // 키보드 단축키: V=Select, D=Draw, Delete=삭제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedId } = useChoanStore.getState()
        if (selectedId) removeElement(selectedId)
      } else if (e.key === 'v' || e.key === 'V') {
        setTool('select')
      } else if (e.key === 'd' || e.key === 'D') {
        setTool('draw')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeElement, setTool])

  const cursor = isZViewMode ? 'grab' : tool === 'draw' ? 'crosshair' : 'default'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      {/* 캔버스 플로팅 툴바 */}
      <div className="canvas-toolbar">
        <button
          className={`canvas-tool ${tool === 'select' ? 'active' : ''}`}
          onClick={() => setTool('select')}
          title="Select (V)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 1L3 13L6.5 9.5L10 14L12 13L8.5 8.5L13 8L3 1Z" fill="currentColor"/>
          </svg>
        </button>
        <button
          className={`canvas-tool ${tool === 'draw' ? 'active' : ''}`}
          onClick={() => setTool('draw')}
          title="Draw (D)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12.1 1.3L14.7 3.9L5.1 13.5L1 15L2.5 10.9L12.1 1.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      {/* 드로잉 오버레이 SVG */}
      <svg
        ref={svgOverlayRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {drawPath && (
          <path d={drawPath} fill="rgba(80,80,200,0.25)" stroke="rgba(80,80,200,0.6)" strokeWidth={1} />
        )}
      </svg>
      {isZViewMode && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(26,26,46,0.75)', color: '#fff', padding: '4px 12px',
          borderRadius: 8, fontSize: 12, pointerEvents: 'none',
        }}>
          Z-View 모드 — 마우스로 회전, 편집 불가
        </div>
      )}
    </div>
  )
}
