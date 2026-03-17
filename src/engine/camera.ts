// Perspective Camera for ray marching

export interface Camera {
  position: [number, number, number]
  target: [number, number, number]
  up: [number, number, number]
  fov: number    // degrees
  near: number
  far: number
  aspect: number
}

export function createCamera(): Camera {
  return {
    position: [0, 0, 20],
    target: [0, 0, 0],
    up: [0, 1, 0],
    fov: 50,
    near: 0.1,
    far: 1000,
    aspect: 1,
  }
}

// Build view matrix (column-major for GLSL)
export function getViewMatrix(cam: Camera): Float32Array {
  const [ex, ey, ez] = cam.position
  const [cx, cy, cz] = cam.target
  const [ux, uy, uz] = cam.up

  // forward = normalize(target - eye)
  let fx = cx - ex, fy = cy - ey, fz = cz - ez
  let fl = Math.sqrt(fx * fx + fy * fy + fz * fz)
  fx /= fl; fy /= fl; fz /= fl

  // right = normalize(forward x up)
  let rx = fy * uz - fz * uy
  let ry = fz * ux - fx * uz
  let rz = fx * uy - fy * ux
  let rl = Math.sqrt(rx * rx + ry * ry + rz * rz)
  rx /= rl; ry /= rl; rz /= rl

  // true up = right x forward
  const tux = ry * fz - rz * fy
  const tuy = rz * fx - rx * fz
  const tuz = rx * fy - ry * fx

  // Column-major 4x4
  return new Float32Array([
    rx, tux, -fx, 0,
    ry, tuy, -fy, 0,
    rz, tuz, -fz, 0,
    -(rx * ex + ry * ey + rz * ez),
    -(tux * ex + tuy * ey + tuz * ez),
    -(-fx * ex + -fy * ey + -fz * ez),
    1,
  ])
}

// ── View-Projection matrix for overlay rendering ──

export function buildViewProjMatrix(
  camPos: [number, number, number],
  camTarget: [number, number, number],
  camUp: [number, number, number],
  fov: number, // degrees
  aspect: number,
  near: number,
  far: number,
): Float32Array {
  const [ex, ey, ez] = camPos
  const [cx, cy, cz] = camTarget

  let fx = cx - ex, fy = cy - ey, fz = cz - ez
  let fl = Math.sqrt(fx * fx + fy * fy + fz * fz)
  fx /= fl; fy /= fl; fz /= fl

  let rx = fy * camUp[2] - fz * camUp[1]
  let ry = fz * camUp[0] - fx * camUp[2]
  let rz = fx * camUp[1] - fy * camUp[0]
  let rl = Math.sqrt(rx * rx + ry * ry + rz * rz)
  rx /= rl; ry /= rl; rz /= rl

  const ux = ry * fz - rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy - ry * fx

  const f = 1.0 / Math.tan(fov * Math.PI / 180 * 0.5)
  const nf = 1 / (near - far)

  const v00 = rx, v01 = ux, v02 = -fx
  const v10 = ry, v11 = uy, v12 = -fy
  const v20 = rz, v21 = uz, v22 = -fz
  const v30 = -(rx * ex + ry * ey + rz * ez)
  const v31 = -(ux * ex + uy * ey + uz * ez)
  const v32 = -(-fx * ex + -fy * ey + -fz * ez)

  const p00 = f / aspect
  const p11 = f
  const p22 = (far + near) * nf
  const p23 = -1
  const p32 = 2 * far * near * nf

  return new Float32Array([
    p00 * v00, p11 * v01, p22 * v02,       -v02,
    p00 * v10, p11 * v11, p22 * v12,       -v12,
    p00 * v20, p11 * v21, p22 * v22,       -v22,
    p00 * v30, p11 * v31, p22 * v32 + p32, -v32,
  ])
}

// Camera direction vectors for ray generation in shader
export function getCameraRayParams(cam: Camera): {
  ro: [number, number, number]
  forward: [number, number, number]
  right: [number, number, number]
  up: [number, number, number]
  fovScale: number
} {
  const [ex, ey, ez] = cam.position
  const [cx, cy, cz] = cam.target

  let fx = cx - ex, fy = cy - ey, fz = cz - ez
  let fl = Math.sqrt(fx * fx + fy * fy + fz * fz)
  fx /= fl; fy /= fl; fz /= fl

  let rx = fy * cam.up[2] - fz * cam.up[1]
  let ry = fz * cam.up[0] - fx * cam.up[2]
  let rz = fx * cam.up[1] - fy * cam.up[0]
  let rl = Math.sqrt(rx * rx + ry * ry + rz * rz)
  rx /= rl; ry /= rl; rz /= rl

  const ux = ry * fz - rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy - ry * fx

  const fovScale = Math.tan((cam.fov * Math.PI / 180) * 0.5)

  return {
    ro: [ex, ey, ez],
    forward: [fx, fy, fz],
    right: [rx, ry, rz],
    up: [ux, uy, uz],
    fovScale,
  }
}
