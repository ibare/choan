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

// Three.js 단위 ↔ 캔버스 픽셀 변환 스케일
const WORLD_SCALE = 0.01

function canvasToWorld(x: number, y: number): [number, number] {
  return [x * WORLD_SCALE, -y * WORLD_SCALE]
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
  const isPointerDownRef = useRef(false)
  const currentPointsRef = useRef<InputPoint[]>([])
  const svgOverlayRef = useRef<SVGSVGElement | null>(null)
  const [drawPath, setDrawPath] = useState('')

  const {
    elements,
    selectedId,
    tool,
    isZViewMode,
    addElement,
    selectElement,
    removeElement,
  } = useChoanStore()

  // Three.js 초기화
  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current
    const w = mount.clientWidth
    const h = mount.clientHeight

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
    const frustum = 10
    const ortho = new THREE.OrthographicCamera(
      -frustum * aspect,
      frustum * aspect,
      frustum,
      -frustum,
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

    // 렌더 루프
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      const cam = isZViewMode ? persp : ortho
      if (isZViewMode && controls) controls.update()
      renderer.render(scene, cam)
    }
    animate()

    // 리사이즈
    const onResize = () => {
      const nw = mount.clientWidth
      const nh = mount.clientHeight
      renderer.setSize(nw, nh)
      const asp = nw / nh
      ortho.left = -frustum * asp
      ortho.right = frustum * asp
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

  // 렌더 루프에서 카메라 업데이트를 위해 isZViewMode를 ref로 추적
  // (animate 클로저 문제 우회 — scene과 cameras는 ref로 직접 접근)
  const isZViewRef = useRef(isZViewMode)
  useEffect(() => { isZViewRef.current = isZViewMode }, [isZViewMode])

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
      const [wx, wy] = canvasToWorld(el.x + el.width / 2, el.y + el.height / 2)
      const ww = el.width * WORLD_SCALE
      const wh = el.height * WORLD_SCALE

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

  // 드로잉 이벤트
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (tool !== 'draw' || isZViewMode) return
      isPointerDownRef.current = true
      currentPointsRef.current = [[e.nativeEvent.offsetX, e.nativeEvent.offsetY, e.pressure]]
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [tool, isZViewMode]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPointerDownRef.current || tool !== 'draw') return
      currentPointsRef.current = [
        ...currentPointsRef.current,
        [e.nativeEvent.offsetX, e.nativeEvent.offsetY, e.pressure],
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

  // 클릭으로 요소 선택 (select 모드)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (tool !== 'select' || isZViewMode) return
      const mount = mountRef.current
      const ortho = cameraOrthoRef.current
      const scene = sceneRef.current
      if (!mount || !ortho || !scene) return

      const rect = mount.getBoundingClientRect()
      const ndcX = ((e.clientX - rect.left) / mount.clientWidth) * 2 - 1
      const ndcY = -((e.clientY - rect.top) / mount.clientHeight) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), ortho)

      const meshObjects: THREE.Object3D[] = []
      for (const rec of meshMapRef.current.values()) {
        rec.group.traverse((obj) => { if ((obj as THREE.Mesh).isMesh) meshObjects.push(obj) })
      }

      const hits = raycaster.intersectObjects(meshObjects, false)
      if (hits.length === 0) {
        selectElement(null)
        return
      }

      // 히트된 메쉬의 부모 group을 찾아 id 매핑
      const hitObj = hits[0].object
      for (const [id, rec] of meshMapRef.current) {
        if (rec.group === hitObj.parent || rec.group === hitObj.parent?.parent) {
          selectElement(id)
          return
        }
      }
    },
    [tool, isZViewMode, selectElement]
  )

  // Delete 키로 선택 요소 삭제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedId } = useChoanStore.getState()
        if (selectedId) removeElement(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeElement])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%', cursor: tool === 'draw' ? 'crosshair' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      />
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
