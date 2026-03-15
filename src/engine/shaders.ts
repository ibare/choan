// GLSL shader sources as template literals

export const RAYMARCH_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUV;

void main() {
  vUV = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

export const RAYMARCH_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform vec2 uResolution;
uniform vec3 uBgColor;

// Camera
uniform vec3 uCamPos;
uniform vec3 uCamForward;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uFovScale;

// ─── SDF Primitives ───────────────────────────────

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// ─── Scene ────────────────────────────────────────

// Returns vec2(distance, objectID)
// For now: hardcoded test objects
vec2 sceneSDF(vec3 p) {
  vec2 res = vec2(1e10, -1.0);

  // Test rounded box at origin
  float d1 = sdRoundBox(p - vec3(0.0, 0.0, 0.0), vec3(2.0, 1.5, 0.075), 0.2);
  if (d1 < res.x) res = vec2(d1, 0.0);

  // Test smaller box offset
  float d2 = sdRoundBox(p - vec3(3.0, 1.0, 0.0), vec3(1.0, 0.8, 0.075), 0.1);
  if (d2 < res.x) res = vec2(d2, 1.0);

  // Test circle (fully rounded box)
  float d3 = sdRoundBox(p - vec3(-3.0, -1.0, 0.0), vec3(1.0, 1.0, 0.075), 1.0);
  if (d3 < res.x) res = vec2(d3, 2.0);

  return res;
}

// ─── Normal (tetrahedron technique, 4 evals) ──────

vec3 calcNormal(vec3 p) {
  const float h = 0.001;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * sceneSDF(p + k.xyy * h).x +
    k.yyx * sceneSDF(p + k.yyx * h).x +
    k.yxy * sceneSDF(p + k.yxy * h).x +
    k.xxx * sceneSDF(p + k.xxx * h).x
  );
}

// ─── Ray March ────────────────────────────────────

const int MAX_STEPS = 64;
const float MAX_DIST = 100.0;
const float EPSILON = 0.001;

vec2 rayMarch(vec3 ro, vec3 rd) {
  float t = 0.0;
  vec2 res = vec2(-1.0);
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    vec2 h = sceneSDF(p);
    if (h.x < EPSILON) {
      res = vec2(t, h.y);
      break;
    }
    t += h.x;
    if (t > MAX_DIST) break;
  }
  return res;
}

// ─── Hardcoded test colors ────────────────────────

vec3 getObjectColor(float id) {
  if (id < 0.5) return vec3(0.490, 0.863, 0.675);  // Mint 0x7DDCAC
  if (id < 1.5) return vec3(0.494, 0.784, 0.973);  // Sky 0x7EC8F8
  return vec3(0.663, 0.557, 0.961);                  // Lavender 0xA98EF5
}

// ─── Main ─────────────────────────────────────────

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / uResolution.y;

  // Ray
  vec3 ro = uCamPos;
  vec3 rd = normalize(uCamForward + uv.x * uFovScale * uCamRight + uv.y * uFovScale * uCamUp);

  // March
  vec2 hit = rayMarch(ro, rd);

  if (hit.y < 0.0) {
    // Miss → background
    fragColor = vec4(uBgColor, 1.0);
    return;
  }

  // Hit
  vec3 p = ro + rd * hit.x;
  vec3 normal = calcNormal(p);
  vec3 baseColor = getObjectColor(hit.y);

  // Simple diffuse for now (will be replaced by toon shading in Phase 3)
  vec3 lightDir = normalize(vec3(0.5, 1.0, 1.0));
  float diff = max(dot(normal, lightDir), 0.0);
  vec3 color = baseColor * (0.3 + 0.7 * diff);

  fragColor = vec4(color, 1.0);
}
`
