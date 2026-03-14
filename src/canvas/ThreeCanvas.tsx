import { useEffect, useRef, useCallback, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  createElementMesh,
  createRectGeometry,
  createCircleGeometry,
  createLineGeometry,
  updateEdgeResolutions,
  EXTRUDE_DEPTH,
  PALETTE,
  THEME_COLORS,
  type GeoPair,
} from './materials'

import { useChoanStore } from '../store/useChoanStore'
import type { ChoanElement, Tool } from '../store/useChoanStore'
import { nanoid } from './nanoid'
import {
  computeSnapMove, computeSnapResize, computeDistances,
  type SnapLine, type DistanceMeasure,
} from './snapUtils'

const FRUSTUM = 10

const SELECT_COLOR = 0x4a90d9
const HANDLE_HIT_RADIUS = 16 // 코너 핸들 클릭 판정 반경 (px)
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
  aspect: number // height/width ratio (사각형 코너 아크 보정용)
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
  const snapGroupRef = useRef<THREE.Group | null>(null)
  const distanceGroupRef = useRef<THREE.Group | null>(null)
  const canvasSizeRef = useRef({ w: 1, h: 1 })
  const copiedRef = useRef<ChoanElement | null>(null)

  const [altPressed, setAltPressed] = useState(false)
  const [distanceLabels, setDistanceLabels] = useState<Array<{ x: number; y: number; text: string }>>([])

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

  // 픽셀 좌표 → 월드 좌표 (worldToPixel의 역함수)
  const pixelToWorld = useCallback((px: number, py: number): { wx: number; wy: number } => {
    const { w, h } = canvasSizeRef.current
    const aspect = w / h
    return {
      wx: -FRUSTUM * aspect + (px / w) * 2 * FRUSTUM * aspect,
      wy: FRUSTUM - (py / h) * 2 * FRUSTUM,
    }
  }, [])

  // 월드 좌표 → 스크린 픽셀 좌표 (거리 레이블 위치 계산용)
  const worldToScreen = useCallback((wx: number, wy: number): { x: number; y: number } | null => {
    const camera = cameraRef.current
    const mount = mountRef.current
    if (!camera || !mount) return null
    const v = new THREE.Vector3(wx, wy, 0).project(camera)
    return {
      x: (v.x * 0.5 + 0.5) * mount.clientWidth,
      y: (-v.y * 0.5 + 0.5) * mount.clientHeight,
    }
  }, [])

  // Three.js 스냅 가이드 라인 업데이트
  const updateSnapLines = useCallback((lines: SnapLine[]) => {
    const group = snapGroupRef.current
    if (!group) return
    while (group.children.length) group.remove(group.children[0])
    for (const { x1, y1, x2, y2 } of lines) {
      const p1 = pixelToWorld(x1, y1)
      const p2 = pixelToWorld(x2, y2)
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p1.wx, p1.wy, 0.5),
        new THREE.Vector3(p2.wx, p2.wy, 0.5),
      ])
      const mat = new THREE.LineBasicMaterial({ color: 0x0ea5e9, depthTest: false })
      const line = new THREE.Line(geo, mat)
      line.renderOrder = 997
      group.add(line)
    }
  }, [pixelToWorld])

  // Three.js 거리 측정 라인 업데이트
  const updateDistanceLines = useCallback((measures: (DistanceMeasure | null)[]) => {
    const group = distanceGroupRef.current
    if (!group) return
    while (group.children.length) group.remove(group.children[0])
    const TICK = 5
    for (const m of measures) {
      if (!m) continue
      const p1 = pixelToWorld(m.x1, m.y1)
      const p2 = pixelToWorld(m.x2, m.y2)
      const mat = new THREE.LineBasicMaterial({ color: 0xf97316, depthTest: false })
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p1.wx, p1.wy, 0.5),
        new THREE.Vector3(p2.wx, p2.wy, 0.5),
      ])
      const mainLine = new THREE.Line(geo, mat)
      mainLine.renderOrder = 996
      group.add(mainLine)
      // 끝점 틱 마크
      const isVert = m.x1 === m.x2
      for (const [px, py] of [[m.x1, m.y1], [m.x2, m.y2]] as [number, number][]) {
        const ta = pixelToWorld(isVert ? px - TICK : px, isVert ? py : py - TICK)
        const tb = pixelToWorld(isVert ? px + TICK : px, isVert ? py : py + TICK)
        const tGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(ta.wx, ta.wy, 0.5),
          new THREE.Vector3(tb.wx, tb.wy, 0.5),
        ])
        const tick = new THREE.Line(tGeo, mat)
        tick.renderOrder = 996
        group.add(tick)
      }
    }
  }, [pixelToWorld])

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

    const snapGroup = new THREE.Group()
    scene.add(snapGroup)
    snapGroupRef.current = snapGroup

    const distanceGroup = new THREE.Group()
    scene.add(distanceGroup)
    distanceGroupRef.current = distanceGroup

    // PerspectiveCamera
    const aspect = w / h
    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000)
    camera.position.set(0, 0, 20)
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
      const elAspect = el.type === 'rectangle' ? el.height / el.width : 1
      let rec = meshMap.get(el.id)

      // radius 또는 종횡비 변경 시 메쉬 재생성 (둥근 사각형의 코너 아크 보정)
      if (rec && (rec.radius !== elRadius ||
          (el.type === 'rectangle' && Math.abs(rec.aspect - elAspect) > 0.01))) {
        scene.remove(rec.group)
        meshMap.delete(el.id)
        rec = undefined
      }

      if (rec) {
        // 위치/크기 업데이트
        rec.group.position.set(wx, wy, el.z * EXTRUDE_DEPTH)
        // 사각형: 종횡비가 지오메트리에 내장되어 있으므로 균등 스케일링
        if (el.type === 'rectangle') {
          rec.group.scale.set(ww, ww, 1)
        } else {
          rec.group.scale.set(ww, wh, 1)
        }
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
          pair = createRectGeometry(elRadius, elAspect)
        }
        const group = createElementMesh(pair, color)

        group.position.set(wx, wy, el.z * EXTRUDE_DEPTH)
        if (el.type === 'rectangle') {
          group.scale.set(ww, ww, 1)
        } else {
          group.scale.set(ww, wh, 1)
        }
        scene.add(group)
        meshMap.set(el.id, { id: el.id, group, color, radius: elRadius, aspect: elAspect })
      }
    }

    // 선택 헬퍼: 바운딩 박스 + 코너 핸들
    if (selectHelperRef.current) {
      scene.remove(selectHelperRef.current)
      selectHelperRef.current = null
    }

    if (selectedId && meshMap.has(selectedId)) {
      const rec = meshMap.get(selectedId)!
      const selEl = elements.find((e) => e.id === selectedId)!
      const pos = rec.group.position

      const helper = new THREE.Group()
      helper.position.copy(pos)
      helper.position.z += 0.02 // 메쉬 앞에 살짝

      // 실제 월드 크기 계산 (스케일 방식에 의존하지 않음)
      const { w: cw, h: ch } = canvasSizeRef.current
      const cAspect = cw / ch
      const hw = ((selEl.width / cw) * 2 * FRUSTUM * cAspect) / 2
      const hh = ((selEl.height / ch) * 2 * FRUSTUM) / 2
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
      // depthTest: false → 다른 메시에 가려지지 않고 항상 최상위에 렌더링
      const lineMat = new THREE.LineDashedMaterial({
        color: SELECT_COLOR,
        dashSize: 0.06,
        gapSize: 0.03,
        linewidth: 1,
        depthTest: false,
      })
      const box = new THREE.LineLoop(lineGeo, lineMat)
      box.computeLineDistances()
      box.renderOrder = 999
      helper.add(box)

      // 코너 핸들 (4개 사각형 — 리사이즈 핸들)
      const handleSize = 0.10
      const handleGeo = new THREE.PlaneGeometry(handleSize, handleSize)
      const handleMat = new THREE.MeshBasicMaterial({ color: SELECT_COLOR, depthTest: false })
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
        handle.renderOrder = 999
        helper.add(handle)
      }

      scene.add(helper)
      selectHelperRef.current = helper
    }
  }, [elements, selectedId])

  // 레이캐스트로 요소 히트 테스트
  // 같은 z 레벨의 겹친 요소는 시각적으로 위에 보이는 것(z 값 높음 → elements 배열 뒤)을 선택
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

      // 히트된 요소 ID 전체 수집 (중복 제거)
      const hitIds: string[] = []
      for (const hit of hits) {
        for (const [id, rec] of meshMapRef.current) {
          if (!hitIds.includes(id) &&
              (rec.group === hit.object.parent || rec.group === hit.object.parent?.parent)) {
            hitIds.push(id)
          }
        }
      }
      if (hitIds.length === 0) return null

      // 시각적으로 가장 위: z 높을수록, z 같으면 elements 배열 뒤에 있을수록 위
      const { elements: els } = useChoanStore.getState()
      const topmost = hitIds.reduce((best, id) => {
        const bestEl = els.find((e) => e.id === best)
        const curEl = els.find((e) => e.id === id)
        if (!bestEl || !curEl) return best
        if (curEl.z !== bestEl.z) return curEl.z > bestEl.z ? id : best
        // z 같으면 배열 상 더 뒤에 있는 것 (나중에 추가된 = 화면에서 위에 렌더링)
        return els.indexOf(curEl) > els.indexOf(bestEl) ? id : best
      })
      return topmost
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
      const { elements: els } = useChoanStore.getState()

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
        const proposed = {
          x: resizeCornerStartRef.current.x + pixelDelta.dx,
          y: resizeCornerStartRef.current.y + pixelDelta.dy,
        }
        const others = els.filter((e) => e.id !== selectedId)
        const snap = computeSnapResize(anchor, proposed, others)
        updateSnapLines(snap.lines)
        updateElement(selectedId, {
          x: Math.min(anchor.x, snap.x),
          y: Math.min(anchor.y, snap.y),
          width: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.x - snap.x)),
          height: Math.max(MIN_ELEMENT_SIZE, Math.abs(anchor.y - snap.y)),
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
        const el = els.find((e) => e.id === selectedId)
        if (!el) return
        const proposed = {
          x: dragElStartRef.current.x + pixelDelta.dx,
          y: dragElStartRef.current.y + pixelDelta.dy,
          width: el.width,
          height: el.height,
        }
        const others = els.filter((e) => e.id !== selectedId)
        const snap = computeSnapMove(proposed, others)
        updateSnapLines(snap.lines)
        updateElement(selectedId, {
          x: proposed.x + snap.dx,
          y: proposed.y + snap.dy,
        })
      }
    },
    [tool, selectedId, updateElement, screenToWorld, worldDeltaToPixel, updateSnapLines]
  )

  const handlePointerUp = useCallback(() => {
    if (isResizingRef.current) {
      isResizingRef.current = false
      updateSnapLines([])
      return
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      updateSnapLines([])
    }
  }, [updateSnapLines])

  // 키보드 단축키: V=Select, R=Rectangle, C=Circle, L=Line, Delete=삭제
  // Ctrl/Cmd+C=복사, Ctrl/Cmd+V=붙여넣기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedId } = useChoanStore.getState()
        if (selectedId) removeElement(selectedId)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const { selectedId, elements } = useChoanStore.getState()
        if (selectedId) copiedRef.current = elements.find((el) => el.id === selectedId) ?? null
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const src = copiedRef.current
        if (src) {
          const id = nanoid()
          const { addElement, selectElement } = useChoanStore.getState()
          addElement({ ...src, id, x: src.x + 20, y: src.y + 20 })
          selectElement(id)
        }
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

  // Alt 키: 요소 간 거리 시각화
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Alt') { e.preventDefault(); setAltPressed(true) } }
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltPressed(false) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  // Alt 키 거리 시각화 업데이트
  useEffect(() => {
    const group = distanceGroupRef.current
    if (!group) return

    if (!altPressed || !selectedId) {
      while (group.children.length) group.remove(group.children[0])
      setDistanceLabels([])
      return
    }

    const el = elements.find((e) => e.id === selectedId)
    if (!el) return
    const others = elements.filter((e) => e.id !== selectedId)
    const { left, right, top, bottom } = computeDistances(el, others)
    const measures = [left, right, top, bottom]
    updateDistanceLines(measures)

    const labels: Array<{ x: number; y: number; text: string }> = []
    for (const m of measures) {
      if (!m) continue
      const { wx, wy } = pixelToWorld(m.midX, m.midY)
      const screen = worldToScreen(wx, wy)
      if (screen) labels.push({ x: screen.x, y: screen.y, text: `${Math.round(m.distance)}` })
    }
    setDistanceLabels(labels)
  }, [altPressed, selectedId, elements, updateDistanceLines, pixelToWorld, worldToScreen])

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
      {/* 거리 측정 레이블 (Alt 키) */}
      {distanceLabels.map((label, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: label.x,
            top: label.y,
            transform: 'translate(-50%, -50%)',
            background: 'rgba(249,115,22,0.92)',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {label.text}
        </div>
      ))}
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
