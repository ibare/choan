import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

// 테마 컬러 팔레트 — 파스텔 + 뉴트럴
export const THEME_COLORS: { name: string; hex: number }[] = [
  // Pastels (medium)
  { name: 'Mint',     hex: 0x7DDCAC },
  { name: 'Sky',      hex: 0x7EC8F8 },
  { name: 'Lavender', hex: 0xA98EF5 },
  { name: 'Lilac',    hex: 0xC090FF },
  { name: 'Rose',     hex: 0xFF8FAF },
  { name: 'Peach',    hex: 0xFFA07A },
  { name: 'Butter',   hex: 0xFFD84A },
  // Neutrals (light)
  { name: 'White',    hex: 0xFFFFFF },
  { name: 'Ivory',    hex: 0xFDFBF5 },
  { name: 'Sand',     hex: 0xF5EFE0 },
  { name: 'Khaki',    hex: 0xEDE4D0 },
  { name: 'Beige',    hex: 0xE4D8C0 },
]

export const PALETTE = THEME_COLORS.map((c) => c.hex)

const OUTLINE_COLOR = 0x222222
const EXTRUDE_DEPTH = 0.15

// ── Geometry 팩토리 (얇은 합판 두께) ──

export interface GeoPair {
  renderGeo: THREE.BufferGeometry  // non-indexed → 렌더링용
  edgeGeo: THREE.BufferGeometry    // indexed 원본 → EdgesGeometry용
}

function extrudeShape(shape: THREE.Shape, depth: number): GeoPair {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geo.translate(0, 0, -depth / 2)
  const nonIndexed = geo.toNonIndexed()
  return { renderGeo: nonIndexed, edgeGeo: geo }
}

export function createRectGeometry(radius = 0): GeoPair {
  const shape = new THREE.Shape()
  const r = Math.min(Math.max(radius, 0), 1) * 0.5 // 0~1 → 0~0.5 geometry units
  if (r <= 0.001) {
    shape.moveTo(-0.5, -0.5)
    shape.lineTo(0.5, -0.5)
    shape.lineTo(0.5, 0.5)
    shape.lineTo(-0.5, 0.5)
    shape.closePath()
  } else {
    shape.moveTo(-0.5 + r, -0.5)
    shape.lineTo(0.5 - r, -0.5)
    shape.absarc(0.5 - r, -0.5 + r, r, -Math.PI / 2, 0, false)
    shape.lineTo(0.5, 0.5 - r)
    shape.absarc(0.5 - r, 0.5 - r, r, 0, Math.PI / 2, false)
    shape.lineTo(-0.5 + r, 0.5)
    shape.absarc(-0.5 + r, 0.5 - r, r, Math.PI / 2, Math.PI, false)
    shape.lineTo(-0.5, -0.5 + r)
    shape.absarc(-0.5 + r, -0.5 + r, r, Math.PI, Math.PI * 1.5, false)
  }
  return extrudeShape(shape, EXTRUDE_DEPTH)
}

export function createCircleGeometry(segments = 32): GeoPair {
  const shape = new THREE.Shape()
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle) * 0.5
    const y = Math.sin(angle) * 0.5
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return extrudeShape(shape, EXTRUDE_DEPTH)
}

export function createLineGeometry(): GeoPair {
  const shape = new THREE.Shape()
  shape.moveTo(-0.5, -0.025)
  shape.lineTo(0.5, -0.025)
  shape.lineTo(0.5, 0.025)
  shape.lineTo(-0.5, 0.025)
  shape.closePath()
  return extrudeShape(shape, EXTRUDE_DEPTH * 0.5)
}

const EDGE_LINE_WIDTH = 3 // px (screen-space)

// LineMaterial은 resolution을 수동으로 설정해야 함 — 리사이즈 시 호출
export function updateEdgeResolutions(scene: THREE.Scene, w: number, h: number): void {
  scene.traverse((obj) => {
    if ((obj as LineSegments2).isLineSegments2) {
      const mat = (obj as LineSegments2).material as LineMaterial
      mat.resolution.set(w, h)
    }
  })
}

function darkenColor(hex: number, factor: number): number {
  const r = Math.floor(((hex >> 16) & 0xff) * factor)
  const g = Math.floor(((hex >> 8) & 0xff) * factor)
  const b = Math.floor((hex & 0xff) * factor)
  return (r << 16) | (g << 8) | b
}

export function createElementMesh(
  pair: GeoPair,
  color: number
): THREE.Group {
  const group = new THREE.Group()

  // children[0]: 메인 메쉬 — MeshBasicMaterial (비조명)
  // 전면/후면(group 0) 원색 100%, 측면(group 1) 82% 어둡게
  const frontMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  const sideMat = new THREE.MeshBasicMaterial({ color: darkenColor(color, 0.82), side: THREE.DoubleSide })
  const mainMesh = new THREE.Mesh(pair.renderGeo, [frontMat, sideMat])
  group.add(mainMesh)

  // children[1]: 굵은 엣지 라인 (Line2 — screen-space 두께 지원)
  const edges = new THREE.EdgesGeometry(pair.edgeGeo, 15)
  const edgePos = edges.getAttribute('position')
  const lineGeo = new LineSegmentsGeometry()
  lineGeo.setPositions(edgePos.array as Float32Array)

  const lineMat = new LineMaterial({
    color: OUTLINE_COLOR,
    linewidth: EDGE_LINE_WIDTH,
  })
  lineMat.resolution.set(window.innerWidth, window.innerHeight)

  const edgeLines = new LineSegments2(lineGeo, lineMat)
  edgeLines.computeLineDistances()
  group.add(edgeLines)

  return group
}
