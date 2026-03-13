import * as THREE from 'three'

// 파스텔 팔레트
export const PALETTE = [
  0xffb3ba, // pastel red
  0xffdfba, // pastel orange
  0xffffba, // pastel yellow
  0xbaffc9, // pastel green
  0xbae1ff, // pastel blue
  0xe8baff, // pastel purple
  0xffd6e0, // pastel pink
  0xd4f1f4, // pastel cyan
]

let paletteIndex = 0

export function nextColor(): number {
  return PALETTE[paletteIndex++ % PALETTE.length]
}

export function createToonMaterial(color?: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: color ?? nextColor(),
    side: THREE.DoubleSide,
  })
}

export function createOutlineMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x1a1a2e,
    side: THREE.BackSide,
  })
}

const OUTLINE_SCALE = 1.06

export function createElementMesh(
  geometry: THREE.BufferGeometry,
  color?: number
): THREE.Group {
  const group = new THREE.Group()

  // 메인 툰 메쉬
  const mainMesh = new THREE.Mesh(geometry, createToonMaterial(color))
  mainMesh.receiveShadow = true

  // 아웃라인 메쉬 (BackSide scale trick)
  const outlineGeo = geometry.clone()
  const outlineMesh = new THREE.Mesh(outlineGeo, createOutlineMaterial())
  outlineMesh.scale.set(OUTLINE_SCALE, OUTLINE_SCALE, OUTLINE_SCALE)

  group.add(outlineMesh)
  group.add(mainMesh)

  return group
}
