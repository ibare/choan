// GLSL shader sources as template literals

export const MAX_OBJECTS = 128

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
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormalId;

uniform vec2 uResolution;
uniform vec3 uBgColor;

// Camera
uniform vec3 uCamPos;
uniform vec3 uCamForward;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uFovScale;

// Toon shading parameters
uniform vec3 uLightDir;
uniform float uShadowMul;
uniform vec3 uWarmTone;
uniform float uSideDarken;
uniform vec2 uSideSmooth;

// Scene UBO (std140)
// Layout: vec4 numObjPad, then per-object: vec4 posType, vec4 sizeRadius, vec4 colorAlpha
#define MAX_OBJECTS ${MAX_OBJECTS}
layout(std140) uniform SceneData {
  vec4 uNumObjPad;           // x = numObjects
  vec4 uPosType[MAX_OBJECTS];
  vec4 uSizeRadius[MAX_OBJECTS];
  vec4 uColorAlpha[MAX_OBJECTS];
};

// Shape types
#define SHAPE_RECT   0.0
#define SHAPE_CIRCLE 1.0
#define SHAPE_LINE   2.0

// ─── SDF Primitives ───────────────────────────────

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

// 2D rounded rect extruded along Z — rounds only XY corners (CSS border-radius)
float sdExtrudedRoundRect(vec3 p, vec3 b, float r) {
  vec2 q = abs(p.xy) - b.xy + r;
  float d2d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  return max(d2d, abs(p.z) - b.z);
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// ─── Scene ────────────────────────────────────────

vec2 sceneSDF(vec3 p) {
  vec2 res = vec2(1e10, -1.0);
  int numObj = int(uNumObjPad.x);

  for (int i = 0; i < MAX_OBJECTS; i++) {
    if (i >= numObj) break;

    vec3 lp = p - uPosType[i].xyz;
    vec3 hs = uSizeRadius[i].xyz;

    // Bounding sphere pre-reject — L1 radius with 1.5× safety slack
    float rBound = (hs.x + hs.y + hs.z) * 1.5 + 0.1;
    if (dot(lp, lp) > rBound * rBound) continue;

    float shapeType = uPosType[i].w;
    float radius = uSizeRadius[i].w;
    float d;

    if (shapeType < 0.5) {
      // Rectangle: radius maps 0-1 → 0-min(halfSize.xy), XY only
      float maxR = min(hs.x, hs.y);
      float r = radius * maxR;
      d = sdExtrudedRoundRect(lp, hs, r);
    } else if (shapeType < 1.5) {
      // Circle: fully rounded XY, sharp Z extrusion
      float r = min(hs.x, hs.y);
      d = sdExtrudedRoundRect(lp, hs, r);
    } else {
      // Line: capsule along x-axis
      vec3 a = vec3(-hs.x, 0.0, 0.0);
      vec3 b = vec3( hs.x, 0.0, 0.0);
      d = sdCapsule(lp, a, b, hs.y);
    }

    if (d < res.x) res = vec2(d, float(i));
  }

  return res;
}

// ─── Normal (analytical per-shape, zero extra sceneSDF calls) ─────

vec3 calcNormal(vec3 p, int objId) {
  float stype  = uPosType[objId].w;
  vec3  hs     = uSizeRadius[objId].xyz;
  float radius = uSizeRadius[objId].w;
  vec3  lp     = p - uPosType[objId].xyz;

  if (stype < 1.5) {
    // sdExtrudedRoundRect (rect & circle)
    float r   = (stype < 0.5) ? radius * min(hs.x, hs.y) : min(hs.x, hs.y);
    vec2  q   = abs(lp.xy) - hs.xy + r;
    float d2d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    float dz  = abs(lp.z) - hs.z;

    // Top / bottom face
    if (dz >= d2d - 1e-4) return vec3(0.0, 0.0, sign(lp.z));

    // Side / corner — 2D gradient of the rounded-rect SDF
    vec2  qc = max(q, 0.0);
    float l  = length(qc);
    vec2 n2;
    if (l > 1e-6) {
      n2 = sign(lp.xy) * qc / l;   // rounded corner arc
    } else if (q.x >= q.y) {
      n2 = vec2(sign(lp.x), 0.0);  // left / right side
    } else {
      n2 = vec2(0.0, sign(lp.y));  // front / back side
    }
    return normalize(vec3(n2, 0.0));
  } else {
    // sdCapsule — gradient is direction from closest axis point to p
    vec3 a  = vec3(-hs.x, 0.0, 0.0);
    vec3 ba = vec3(2.0 * hs.x, 0.0, 0.0);
    vec3 pa = lp - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return normalize(pa - ba * h);
  }
}

// ─── Ray March ────────────────────────────────────

const int MAX_STEPS = 128;
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

// ─── Get object color from UBO ────────────────────

vec3 getObjectColor(float id) {
  int idx = int(id);
  if (idx >= 0 && idx < MAX_OBJECTS) {
    return uColorAlpha[idx].rgb;
  }
  return vec3(1.0);
}

float getObjectOpacity(float id) {
  int idx = int(id);
  if (idx >= 0 && idx < MAX_OBJECTS) {
    return uColorAlpha[idx].a;
  }
  return 1.0;
}

// ─── Toon Shading ─────────────────────────────────

vec3 toonShade(vec3 p, vec3 normal, vec3 rd, vec3 baseColor) {
  vec3 lightDir = normalize(uLightDir);

  // Side face detection
  float isSide = 1.0 - abs(normal.z);
  isSide = smoothstep(uSideSmooth.x, uSideSmooth.y, isSide);
  vec3 surfColor = mix(baseColor, baseColor * uSideDarken, isSide);

  // Toon diffuse: 2-band cel shading
  float NdotL = dot(normal, lightDir);
  float fw = fwidth(NdotL);
  float toonDiff = smoothstep(-fw, fw, NdotL);
  vec3 litColor = surfColor;
  vec3 shadowColor = surfColor * uShadowMul + uWarmTone;
  vec3 color = mix(shadowColor, litColor, toonDiff);

  return color;
}

// ─── Main ─────────────────────────────────────────

void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / uResolution.y;

  vec3 ro = uCamPos;
  vec3 rd = normalize(uCamForward + uv.x * uFovScale * uCamRight + uv.y * uFovScale * uCamUp);

  vec2 hit = rayMarch(ro, rd);

  if (hit.y < 0.0) {
    outColor = vec4(uBgColor, 1.0);
    outNormalId = vec4(0.0, 0.0, 0.0, -1.0);
    return;
  }

  vec3 p = ro + rd * hit.x;
  vec3 normal = calcNormal(p, int(hit.y));
  vec3 baseColor = getObjectColor(hit.y);
  float opacity = getObjectOpacity(hit.y);

  // Toon shading (no outline — handled in edge detection pass)
  vec3 color = toonShade(p, normal, rd, baseColor);

  outColor = vec4(color, opacity);
  outNormalId = vec4(normal, hit.y);
}
`

// ─── Edge Detection + Composite (Pass 2) ─────────

export const EDGE_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uColorTex;
uniform sampler2D uNormalIdTex;
uniform vec2 uTexelSize;
uniform float uOutlineWidth;
uniform vec3 uEdgeColor;
uniform vec3 uBgColor;
uniform vec2 uNormalEdgeThreshold;
uniform vec2 uIdEdgeThreshold;

// Roberts Cross on normal — detects crease and curvature edges
float edgeNormal(vec2 uv, float scale) {
  vec3 n00 = texture(uNormalIdTex, uv).xyz;
  vec3 n10 = texture(uNormalIdTex, uv + vec2(scale, 0.0) * uTexelSize).xyz;
  vec3 n01 = texture(uNormalIdTex, uv + vec2(0.0, scale) * uTexelSize).xyz;
  vec3 n11 = texture(uNormalIdTex, uv + vec2(scale, scale) * uTexelSize).xyz;

  vec3 d1 = n11 - n00;
  vec3 d2 = n10 - n01;
  return sqrt(dot(d1, d1) + dot(d2, d2));
}

// Roberts Cross on objectID — detects object boundaries and silhouettes
float edgeObjectId(vec2 uv, float scale) {
  float id00 = texture(uNormalIdTex, uv).w;
  float id10 = texture(uNormalIdTex, uv + vec2(scale, 0.0) * uTexelSize).w;
  float id01 = texture(uNormalIdTex, uv + vec2(0.0, scale) * uTexelSize).w;
  float id11 = texture(uNormalIdTex, uv + vec2(scale, scale) * uTexelSize).w;

  float d1 = abs(id11 - id00);
  float d2 = abs(id10 - id01);
  return smoothstep(uIdEdgeThreshold.x, uIdEdgeThreshold.y, d1 + d2);
}

void main() {
  vec4 color = texture(uColorTex, vUV);
  float objectId = texture(uNormalIdTex, vUV).w;

  float scale = uOutlineWidth;

  // Object boundary edges (always check)
  float idEdge = edgeObjectId(vUV, scale);

  // Normal edges (only for on-object pixels to avoid false edges at background)
  float normalEdge = 0.0;
  if (objectId >= 0.0) {
    normalEdge = edgeNormal(vUV, scale);
    normalEdge = smoothstep(uNormalEdgeThreshold.x, uNormalEdgeThreshold.y, normalEdge);
  }

  float edge = clamp(idEdge + normalEdge, 0.0, 1.0);

  // Composite: apply opacity against background, then draw edge
  vec3 finalColor = mix(uBgColor, color.rgb, color.a);
  finalColor = mix(finalColor, uEdgeColor, edge);

  fragColor = vec4(finalColor, 1.0);
}
`
