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
  const selectHelperRef = useRef<THREE.Group | null>(null)
  const canvasSizeRef = useRef({ w: 1, h: 1 })

  const {
    elements,
    selectedId,
    tool,
    drawColor,
    isZViewMode,
    setTool,
    setDrawColor,
    addElement,
    updateElement,
    selectElement,
    removeElement,
  } = useChoanStore()

  // 드래그 이동 상태
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ px: 0, py: 0 })
  const dragElStartRef = useRef({ x: 0, y: 0 })

  // 리사이즈 상태
  const isResizingRef = useRef(false)
  const resizeStartRef = useRef({ px: 0, py: 0 })
  const resizeCornerStartRef = useRef({ x: 0, y: 0 }) // 드래그 중인 코너의 초기 픽셀 위치
  const resizeAnchorRef = useRef({ x: 0, y: 0 })      // 고정된 반대 코너의 픽셀 위치

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
      updateEdgeResolutions(scene, nw, nh)
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
        // 새 메쉬 생성 — ExtrudeGeometry + flat normals + edge lines
        const color = el.color ?? PALETTE[meshMap.size % PALETTE.length]
        let pair: GeoPair
        if (el.type === 'circle') {
          pair = createCircleGeometry()
        } else if (el.type === 'line') {
          pair = createLineGeometry()
        } else {
          pair = createRectGeometry()
        }
        const group = createElementMesh(pair, color)

        group.position.set(wx, wy, el.z * 0.1)
        group.scale.set(ww, wh, 1)
        scene.add(group)
        meshMap.set(el.id, { id: el.id, group, color })
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
      const boxPts = [
        -(hw + pad), -(hh + pad),
         (hw + pad), -(hh + pad),
         (hw + pad),  (hh + pad),
        -(hw + pad),  (hh + pad),
        -(hw + pad), -(hh + pad),
      ]
      const boxGeo = new THREE.BufferGeometry()
      boxGeo.setAttribute('position', new THREE.Float32BufferAttribute(
        boxPts.flatMap((v, i) => i % 2 === 0 ? [v, 0] : [0]).length ? [] : [],
        3
      ))
      // 간단히 LineLoop로 박스 그리기
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
      for (let i = 0; i < corners.length; i++) {
        const [cx, cy] = corners[i]
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

  // 도형 배치: 클릭 위치 중심에 기본 크기로 생성
  const placeShape = useCallback(
    (shapeType: 'rectangle' | 'circle' | 'line', offsetX: number, offsetY: number) => {
      const size = DEFAULT_SIZE[shapeType]
      const id = nanoid()
      const el: ChoanElement = {
        id,
        type: shapeType,
        label: shapeType === 'rectangle' ? 'Box' : shapeType === 'circle' ? 'Circle' : 'Line',
        role: shapeType === 'rectangle' ? 'container' : undefined,
        color: drawColor,
        x: offsetX - size.w / 2,
        y: offsetY - size.h / 2,
        z: 0,
        width: size.w,
        height: size.h,
        opacity: 1,
      }
      addElement(el)
      selectElement(id)
      setTool('select')
    },
    [drawColor, addElement, selectElement, setTool]
  )

  // 코너 핸들 히트 테스트 (픽셀 공간)
  // 코너 순서: 0=BL, 1=BR, 2=TR, 3=TL (픽셀 좌표 — Y↓)
  const hitTestCorner = useCallback(
    (canvasX: number, canvasY: number): number => {
      if (!selectedId) return -1
      const el = elements.find((e) => e.id === selectedId)
      if (!el) return -1
      const corners = [
        { x: el.x, y: el.y + el.height },             // 0: BL
        { x: el.x + el.width, y: el.y + el.height },   // 1: BR
        { x: el.x + el.width, y: el.y },               // 2: TR
        { x: el.x, y: el.y },                           // 3: TL
      ]
      for (let i = 0; i < corners.length; i++) {
        const dx = canvasX - corners[i].x
        const dy = canvasY - corners[i].y
        if (dx * dx + dy * dy <= HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS) return i
      }
      return -1
    },
    [selectedId, elements]
  )

  // Select 모드: 클릭으로 선택/해제, 드래그 이동, 코너 리사이즈
  // Shape 모드: 클릭으로 도형 배치
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isZViewMode) return
      if (tool === 'select') {
        const mount = mountRef.current
        if (!mount) return
        const rect = mount.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top

        // 1. 리사이즈 핸들 체크
        if (selectedId) {
          const corner = hitTestCorner(canvasX, canvasY)
          if (corner >= 0) {
            const el = elements.find((e) => e.id === selectedId)!
            const cornerPositions = [
              { x: el.x, y: el.y + el.height },
              { x: el.x + el.width, y: el.y + el.height },
              { x: el.x + el.width, y: el.y },
              { x: el.x, y: el.y },
            ]
            isResizingRef.current = true
            resizeStartRef.current = { px: e.clientX, py: e.clientY }
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
          dragStartRef.current = { px: e.clientX, py: e.clientY }
          const el = elements.find((el) => el.id === selectedId)
          if (el) dragElStartRef.current = { x: el.x, y: el.y }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        } else {
          selectElement(hitId)
        }
        return
      }
      // 도형 배치 모드
      placeShape(tool, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
    },
    [isZViewMode, tool, raycastElement, selectElement, selectedId, elements, placeShape, hitTestCorner]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // 리사이즈
      if (isResizingRef.current && selectedId) {
        const dx = e.clientX - resizeStartRef.current.px
        const dy = e.clientY - resizeStartRef.current.py
        const anchor = resizeAnchorRef.current
        const newCornerX = resizeCornerStartRef.current.x + dx
        const newCornerY = resizeCornerStartRef.current.y + dy
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
        const dx = e.clientX - dragStartRef.current.px
        const dy = e.clientY - dragStartRef.current.py
        updateElement(selectedId, {
          x: dragElStartRef.current.x + dx,
          y: dragElStartRef.current.y + dy,
        })
      }
    },
    [tool, selectedId, updateElement]
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
  const cursor = isZViewMode ? 'grab' : isShapeTool ? 'crosshair' : 'default'

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
