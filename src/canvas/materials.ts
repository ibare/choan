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

// 3-tone gradientMap — CanvasTexture로 생성 (WebGL2 호환 보장)
// shadow 70% / mid 88% / highlight 100% → 밝은 파스텔톤에서도 색감 유지
function createGradientMap(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 3
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b3b3b3'  // shadow (~70%)
  ctx.fillRect(0, 0, 1, 1)
  ctx.fillStyle = '#e0e0e0'  // mid (~88%)
  ctx.fillRect(1, 0, 1, 1)
  ctx.fillStyle = '#ffffff'  // highlight (100%)
  ctx.fillRect(2, 0, 1, 1)
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  return texture
}

export const gradientMap = createGradientMap()

export function createToonMaterial(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap,
    side: THREE.DoubleSide,
  })
}

// ExtrudeGeometry의 삼각형 분할 아티팩트를 제거하기 위해
// 면별 노멀을 균일하게 재계산 (flat shading 효과)
export function flattenNormals(geo: THREE.BufferGeometry): void {
  geo.deleteAttribute('normal')
  geo.computeVertexNormals()
  // 스무딩된 노멀 대신 face-normal 적용
  const pos = geo.getAttribute('position')
  const normal = geo.getAttribute('normal')
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3()
  const faceNormal = new THREE.Vector3()

  for (let i = 0; i < pos.count; i += 3) {
    vA.fromBufferAttribute(pos, i)
    vB.fromBufferAttribute(pos, i + 1)
    vC.fromBufferAttribute(pos, i + 2)
    faceNormal.crossVectors(
      vB.clone().sub(vA),
      vC.clone().sub(vA)
    ).normalize()
    normal.setXYZ(i, faceNormal.x, faceNormal.y, faceNormal.z)
    normal.setXYZ(i + 1, faceNormal.x, faceNormal.y, faceNormal.z)
    normal.setXYZ(i + 2, faceNormal.x, faceNormal.y, faceNormal.z)
  }
  normal.needsUpdate = true
}

// ── Geometry 팩토리 (얇은 합판 두께) ──

export interface GeoPair {
  renderGeo: THREE.BufferGeometry  // non-indexed, flat normals → 렌더링용
  edgeGeo: THREE.BufferGeometry    // indexed 원본 → EdgesGeometry용
}

function extrudeAndFlatten(shape: THREE.Shape, depth: number): GeoPair {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geo.translate(0, 0, -depth / 2)
  // non-indexed + flat normals → 삼각분할 아티팩트 제거
  const nonIndexed = geo.toNonIndexed()
  flattenNormals(nonIndexed)
  return { renderGeo: nonIndexed, edgeGeo: geo }
}

export function createRectGeometry(): GeoPair {
  const shape = new THREE.Shape()
  shape.moveTo(-0.5, -0.5)
  shape.lineTo(0.5, -0.5)
  shape.lineTo(0.5, 0.5)
  shape.lineTo(-0.5, 0.5)
  shape.closePath()
  return extrudeAndFlatten(shape, EXTRUDE_DEPTH)
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
  return extrudeAndFlatten(shape, EXTRUDE_DEPTH)
}

export function createLineGeometry(): GeoPair {
  const shape = new THREE.Shape()
  shape.moveTo(-0.5, -0.025)
  shape.lineTo(0.5, -0.025)
  shape.lineTo(0.5, 0.025)
  shape.lineTo(-0.5, 0.025)
  shape.closePath()
  return extrudeAndFlatten(shape, EXTRUDE_DEPTH * 0.5)
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

  // children[0]: 메인 메쉬 — 전면/후면(group 0) 원색, 측면(group 1) 어둡게
  const frontMat = createToonMaterial(color)
  const sideMat = createToonMaterial(darkenColor(color, 0.72))
  const mainMesh = new THREE.Mesh(pair.renderGeo, [frontMat, sideMat])
  mainMesh.castShadow = true
  mainMesh.receiveShadow = true
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
