import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  createElementMesh,
  createRectGeometry,
  createCircleGeometry,
  createLineGeometry,
  updateEdgeResolutions,
  PALETTE,
  THEME_COLORS,
  type GeoPair,
} from './materials'

import { useChoanStore } from '../store/useChoanStore'
import type { ChoanElement, Tool } from '../store/useChoanStore'
import { nanoid } from './nanoid'

const FRUSTUM = 10

const SELECT_COLOR = 0x4a90d9
const HANDLE_HIT_RADIUS = 10 // 코너 핸들 클릭 판정 반경 (px)
const MIN_ELEMENT_SIZE = 10  // 최소 요소 크기 (px)

// 클릭 배치 시 기본 크기 (픽셀)
const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  rectangle: { w: 120, h: 90 },
  circle: { w: 100, h: 100 },
  line: { w: 160, h: 6 },
}

interface MeshRecord {
  id: string
  group: THREE.Group
  color: number
  radius: number
}

// z=0 평면 (레이캐스트 대상)
const Z_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

export default function ThreeCanvas() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const frameRef = useRef<number>(0)
  const meshMapRef = useRef<Map<string, MeshRecord>>(new Map())
  const selectHelperRef = useRef<THREE.Group | null>(null)
  const canvasSizeRef = useRef({ w: 1, h: 1 })

  const {
    elements,
    selectedId,
    tool,
    drawColor,
    setTool,
    setDrawColor,
    addElement,
    updateElement,
    selectElement,
    removeElement,
  } = useChoanStore()

  // 드래그 이동 상태
  const isDraggingRef = useRef(false)
  const dragStartWorldRef = useRef(new THREE.Vector3())
  const dragElStartRef = useRef({ x: 0, y: 0 })

  // 리사이즈 상태
  const isResizingRef = useRef(false)
  const resizeStartWorldRef = useRef(new THREE.Vector3())
  const resizeCornerStartRef = useRef({ x: 0, y: 0 }) // 드래그 중인 코너의 초기 픽셀 위치
  const resizeAnchorRef = useRef({ x: 0, y: 0 })      // 고정된 반대 코너의 픽셀 위치

  // ── 좌표 변환 헬퍼 ──

  // 스크린 좌표 → z=0 평면 위 월드 좌표
  const screenToWorld = useCallback((clientX: number, clientY: number): THREE.Vector3 | null => {
    const mount = mountRef.current
    const camera = cameraRef.current
    if (!mount || !camera) return null
    const rect = mount.getBoundingClientRect()
    const ndcX = ((clientX - rect.left) / mount.clientWidth) * 2 - 1
    const ndcY = -((clientY - rect.top) / mount.clientHeight) * 2 + 1
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
    const target = new THREE.Vector3()
    return raycaster.ray.intersectPlane(Z_PLANE, target)
  }, [])

  // 월드 좌표 → 요소 픽셀 좌표 (FRUSTUM 기반 고정 매핑)
  const worldToPixel = useCallback((wx: number, wy: number): { x: number; y: number } => {
    const { w, h } = canvasSizeRef.current
    const aspect = w / h
    const px = ((wx + FRUSTUM * aspect) / (2 * FRUSTUM * aspect)) * w
    const py = ((FRUSTUM - wy) / (2 * FRUSTUM)) * h
    return { x: px, y: py }
  }, [])

  // 월드 좌표 델타 → 픽셀 델타
  const worldDeltaToPixel = useCallback((dwx: number, dwy: number): { dx: number; dy: number } => {
    const { w, h } = canvasSizeRef.current
    const aspect = w / h
    const dx = (dwx / (2 * FRUSTUM * aspect)) * w
    const dy = (-dwy / (2 * FRUSTUM)) * h
    return { dx, dy }
  }, [])

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

    // PerspectiveCamera
    const aspect = w / h
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000)
    camera.position.set(0, -4, 16)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // OrbitControls — 우클릭 회전, 중클릭 팬, 스크롤 줌, 좌클릭은 앱에서 처리
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.mouseButtons = {
      LEFT: -1 as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    controls.touches = {
      ONE: -1 as unknown as THREE.TOUCH,
      TWO: THREE.TOUCH.DOLLY_PAN,
    }
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.screenSpacePanning = true
    controls.target.set(0, 0, 0)
    controlsRef.current = controls

    // 렌더 루프
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // 리사이즈
    const onResize = () => {
      const nw = mount.clientWidth
      const nh = mount.clientHeight
      canvasSizeRef.current = { w: nw, h: nh }
      renderer.setSize(nw, nh)
      updateEdgeResolutions(scene, nw, nh)
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(frameRef.current)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

      const elRadius = el.type === 'rectangle' ? (el.radius ?? 0) : 0
      let rec = meshMap.get(el.id)

      // radius 변경 시 메쉬 재생성
      if (rec && rec.radius !== elRadius) {
        scene.remove(rec.group)
        meshMap.delete(el.id)
        rec = undefined
      }

      if (rec) {
        // 위치/크기 업데이트
        rec.group.position.set(wx, wy, el.z * 0.1)
        rec.group.scale.set(ww, wh, 1)
        // opacity 반영
        const mainMesh = rec.group.children[0] as THREE.Mesh
        const mats = Array.isArray(mainMesh.material) ? mainMesh.material : [mainMesh.material]
        for (const m of mats) {
          if (m.opacity !== el.opacity) {
            m.opacity = el.opacity
            m.transparent = el.opacity < 1
          }
        }
      } else {
        // 새 메쉬 생성
        const color = el.color ?? PALETTE[meshMap.size % PALETTE.length]
        let pair: GeoPair
        if (el.type === 'circle') {
          pair = createCircleGeometry()
        } else if (el.type === 'line') {
          pair = createLineGeometry()
        } else {
          pair = createRectGeometry(elRadius)
        }
        const group = createElementMesh(pair, color)

        group.position.set(wx, wy, el.z * 0.1)
        group.scale.set(ww, wh, 1)
        scene.add(group)
        meshMap.set(el.id, { id: el.id, group, color, radius: elRadius })
      }
    }

    // 선택 헬퍼: 바운딩 박스 + 코너 핸들
    if (selectHelperRef.current) {
      scene.remove(selectHelperRef.current)
      selectHelperRef.current = null
    }

    if (selectedId && meshMap.has(selectedId)) {
      const rec = meshMap.get(selectedId)!
      const pos = rec.group.position
      const scl = rec.group.scale

      const helper = new THREE.Group()
      helper.position.copy(pos)
      helper.position.z += 0.02 // 메쉬 앞에 살짝

      const hw = scl.x / 2
      const hh = scl.y / 2
      const pad = 0.03 // 바운딩 박스 패딩

      // 바운딩 박스 라인
      const vertices = new Float32Array([
        -(hw + pad), -(hh + pad), 0,
         (hw + pad), -(hh + pad), 0,
         (hw + pad),  (hh + pad), 0,
        -(hw + pad),  (hh + pad), 0,
      ])
      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      const lineMat = new THREE.LineDashedMaterial({
        color: SELECT_COLOR,
        dashSize: 0.06,
        gapSize: 0.03,
        linewidth: 1,
      })
      const box = new THREE.LineLoop(lineGeo, lineMat)
      box.computeLineDistances()
      helper.add(box)

      // 코너 핸들 (4개 사각형 — 리사이즈 핸들)
      const handleSize = 0.10
      const handleGeo = new THREE.PlaneGeometry(handleSize, handleSize)
      const handleMat = new THREE.MeshBasicMaterial({ color: SELECT_COLOR })
      // 0:BL, 1:BR, 2:TR, 3:TL (월드 좌표 기준)
      const corners = [
        [-(hw + pad), -(hh + pad)],
        [ (hw + pad), -(hh + pad)],
        [ (hw + pad),  (hh + pad)],
        [-(hw + pad),  (hh + pad)],
      ]
      for (const [cx, cy] of corners) {
        const handle = new THREE.Mesh(handleGeo, handleMat)
        handle.position.set(cx, cy, 0)
        helper.add(handle)
      }

      scene.add(helper)
      selectHelperRef.current = helper
    }
  }, [elements, selectedId])

  // 레이캐스트로 요소 히트 테스트
  const raycastElement = useCallback(
    (clientX: number, clientY: number): string | null => {
      const mount = mountRef.current
      const camera = cameraRef.current
      if (!mount || !camera) return null

      const rect = mount.getBoundingClientRect()
      const ndcX = ((clientX - rect.left) / mount.clientWidth) * 2 - 1
      const ndcY = -((clientY - rect.top) / mount.clientHeight) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)

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

  // 도형 배치: 클릭 위치에 기본 크기로 생성
  const placeShape = useCallback(
    (shapeType: 'rectangle' | 'circle' | 'line', clientX: number, clientY: number) => {
      const worldPos = screenToWorld(clientX, clientY)
      if (!worldPos) return
      const pixel = worldToPixel(worldPos.x, worldPos.y)
      const size = DEFAULT_SIZE[shapeType]
      const id = nanoid()
      const el: ChoanElement = {
        id,
        type: shapeType,
        label: shapeType === 'rectangle' ? 'Box' : shapeType === 'circle' ? 'Circle' : 'Line',
        role: shapeType === 'rectangle' ? 'container' : undefined,
        color: drawColor,
        x: pixel.x - size.w / 2,
        y: pixel.y - size.h / 2,
        z: 0,
        width: size.w,
        height: size.h,
        opacity: 1,
      }
      addElement(el)
      selectElement(id)
      setTool('select')
    },
    [drawColor, addElement, selectElement, setTool, screenToWorld, worldToPixel]
  )

  // 코너 핸들 히트 테스트 (스크린→월드→픽셀 변환)
  // 코너 순서: 0=BL, 1=BR, 2=TR, 3=TL (픽셀 좌표 — Y↓)
  const hitTestCorner = useCallback(
    (clientX: number, clientY: number): number => {
      if (!selectedId) return -1
      const el = elements.find((e) => e.id === selectedId)
      if (!el) return -1

      const worldPos = screenToWorld(clientX, clientY)
      if (!worldPos) return -1
      const pixel = worldToPixel(worldPos.x, worldPos.y)

      const corners = [
        { x: el.x, y: el.y + el.height },             // 0: BL
        { x: el.x + el.width, y: el.y + el.height },   // 1: BR
        { x: el.x + el.width, y: el.y },               // 2: TR
        { x: el.x, y: el.y },                           // 3: TL
      ]
      for (let i = 0; i < corners.length; i++) {
        const dx = pixel.x - corners[i].x
        const dy = pixel.y - corners[i].y
        if (dx * dx + dy * dy <= HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS) return i
      }
      return -1
    },
    [selectedId, elements, screenToWorld, worldToPixel]
  )

  // Select 모드: 클릭으로 선택/해제, 드래그 이동, 코너 리사이즈
  // Shape 모드: 클릭으로 도형 배치
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return // 좌클릭만 앱에서 처리

      if (tool === 'select') {
        // 1. 리사이즈 핸들 체크
        if (selectedId) {
          const corner = hitTestCorner(e.clientX, e.clientY)
          if (corner >= 0) {
            const el = elements.find((e) => e.id === selectedId)!
            const cornerPositions = [
              { x: el.x, y: el.y + el.height },
              { x: el.x + el.width, y: el.y + el.height },
              { x: el.x + el.width, y: el.y },
              { x: el.x, y: el.y },
            ]
            isResizingRef.current = true
            const worldPos = screenToWorld(e.clientX, e.clientY)
            if (worldPos) resizeStartWorldRef.current.copy(worldPos)
            resizeCornerStartRef.current = cornerPositions[corner]
            resizeAnchorRef.current = cornerPositions[(corner + 2) % 4]
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            return
          }
        }

        // 2. 요소 선택/드래그
        const hitId = raycastElement(e.clientX, e.clientY)
        if (hitId && hitId === selectedId) {
          isDraggingRef.current = true
          const worldPos = screenToWorld(e.clientX, e.clientY)
          if (worldPos) dragStartWorldRef.current.copy(worldPos)
          const el = elements.find((el) => el.id === selectedId)
          if (el) dragElStartRef.current = { x: el.x, y: el.y }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        } else {
          selectElement(hitId)
        }
        return
      }
      // 도형 배치 모드
      placeShape(tool, e.clientX, e.clientY)
    },
    [tool, raycastElement, selectElement, selectedId, elements, placeShape, hitTestCorner, screenToWorld]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // 리사이즈
      if (isResizingRef.current && selectedId) {
        const worldPos = screenToWorld(e.clientX, e.clientY)
        if (!worldPos) return
        const worldDelta = {
          x: worldPos.x - resizeStartWorldRef.current.x,
          y: worldPos.y - resizeStartWorldRef.current.y,
        }
        const pixelDelta = worldDeltaToPixel(worldDelta.x, worldDelta.y)
        const anchor = resizeAnchorRef.current
        const newCornerX = resizeCornerStartRef.current.x + pixelDelta.dx
        const newCornerY = resizeCornerStartRef.current.y + pixelDelta.dy
        updateElement(selectedId, {
          x: Math.min(anchor.x, newCornerX),
          y: Math.min(anchor.y, newCornerY),
          width: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.x - newCornerX)),
          height: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.y - newCornerY)),
        })
        return
      }
      // 드래그 이동
      if (isDraggingRef.current && tool === 'select' && selectedId) {
        const worldPos = screenToWorld(e.clientX, e.clientY)
        if (!worldPos) return
        const worldDelta = {
          x: worldPos.x - dragStartWorldRef.current.x,
          y: worldPos.y - dragStartWorldRef.current.y,
        }
        const pixelDelta = worldDeltaToPixel(worldDelta.x, worldDelta.y)
        updateElement(selectedId, {
          x: dragElStartRef.current.x + pixelDelta.dx,
          y: dragElStartRef.current.y + pixelDelta.dy,
        })
      }
    },
    [tool, selectedId, updateElement, screenToWorld, worldDeltaToPixel]
  )

  const handlePointerUp = useCallback(() => {
    if (isResizingRef.current) {
      isResizingRef.current = false
      return
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false
    }
  }, [])

  // 키보드 단축키: V=Select, R=Rectangle, C=Circle, L=Line, Delete=삭제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedId } = useChoanStore.getState()
        if (selectedId) removeElement(selectedId)
      } else if (e.key === 'v' || e.key === 'V') {
        setTool('select')
      } else if (e.key === 'r' || e.key === 'R') {
        setTool('rectangle')
      } else if (e.key === 'c' || e.key === 'C') {
        setTool('circle')
      } else if (e.key === 'l' || e.key === 'L') {
        setTool('line')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeElement, setTool])

  const isShapeTool = tool !== 'select'
  const cursor = isShapeTool ? 'crosshair' : 'default'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
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
          className={`canvas-tool ${tool === 'rectangle' ? 'active' : ''}`}
          onClick={() => setTool('rectangle')}
          title="Rectangle (R)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
        <button
          className={`canvas-tool ${tool === 'circle' ? 'active' : ''}`}
          onClick={() => setTool('circle')}
          title="Circle (C)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
        <button
          className={`canvas-tool ${tool === 'line' ? 'active' : ''}`}
          onClick={() => setTool('line')}
          title="Line (L)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      {/* 컬러 픽커 툴바 */}
      <div className="canvas-toolbar color-picker-toolbar">
        {THEME_COLORS.map(({ name, hex }) => (
          <button
            key={hex}
            className={`color-swatch ${drawColor === hex ? 'active' : ''}`}
            style={{ background: `#${hex.toString(16).padStart(6, '0')}` }}
            onClick={() => setDrawColor(hex)}
            title={name}
          />
        ))}
      </div>
    </div>
  )
}
