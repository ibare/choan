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
  vec4 uEffect[MAX_OBJECTS];     // x = pulse intensity, y = flash intensity
  vec4 uTexRect[MAX_OBJECTS];    // xy = atlas UV offset, zw = atlas UV scale (0 = no texture)
};

uniform sampler2D uAtlasTex;

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

    // skinOnly: exclude from raymarching entirely (handled in main)
    if (uEffect[i].w > 0.5) continue;

    // Pulse: expand SDF on color change
    d -= uEffect[i].x * 0.015;

    if (d < res.x) res = vec2(d, float(i));
  }

  return res;
}

// ─── Single-object SDF (for normal calculation) ───

float singleSDF(vec3 p, int objId) {
  float shapeType = uPosType[objId].w;
  vec3  hs        = uSizeRadius[objId].xyz;
  float radius    = uSizeRadius[objId].w;
  vec3  lp        = p - uPosType[objId].xyz;

  if (shapeType < 0.5) {
    return sdExtrudedRoundRect(lp, hs, radius * min(hs.x, hs.y));
  } else if (shapeType < 1.5) {
    return sdExtrudedRoundRect(lp, hs, min(hs.x, hs.y));
  } else {
    return sdCapsule(lp, vec3(-hs.x,0,0), vec3(hs.x,0,0), hs.y);
  }
}

float singleSDFWithPulse(vec3 p, int objId) {
  return singleSDF(p, objId) - uEffect[objId].x * 0.015;
}

// ─── Normal (tetrahedron on hit object only — O(1) regardless of N) ─

vec3 calcNormal(vec3 p, int objId) {
  const float h = 0.001;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * singleSDFWithPulse(p + k.xyy * h, objId) +
    k.yyx * singleSDFWithPulse(p + k.yyx * h, objId) +
    k.yxy * singleSDFWithPulse(p + k.yxy * h, objId) +
    k.xxx * singleSDFWithPulse(p + k.xxx * h, objId)
  );
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

  // Default to background
  outColor = vec4(uBgColor, 1.0);
  outNormalId = vec4(0.0, 0.0, 0.0, -1.0);

  if (hit.y >= 0.0) {
    vec3 p = ro + rd * hit.x;
    vec3 normal = calcNormal(p, int(hit.y));
    vec3 baseColor = getObjectColor(hit.y);
    float opacity = getObjectOpacity(hit.y);

    // Flash: blend toward white on color change
    int hitIdx = int(hit.y);
    float flash = (hitIdx >= 0 && hitIdx < MAX_OBJECTS) ? uEffect[hitIdx].y : 0.0;
    baseColor = mix(baseColor, vec3(1.0), flash * 0.5);

    // Atlas texture on front face (Z+) for non-skinOnly objects
    if (hitIdx >= 0 && hitIdx < MAX_OBJECTS) {
      vec4 texRect = uTexRect[hitIdx];
      if (texRect.z > 0.0) {
        vec3 lp = p - uPosType[hitIdx].xyz;
        vec3 hs = uSizeRadius[hitIdx].xyz;
        if (lp.z > hs.z - 0.003) {
          vec2 surfUV = vec2(lp.x / hs.x * 0.5 + 0.5, 1.0 - (lp.y / hs.y * 0.5 + 0.5));
          vec2 atlasUV = texRect.xy + clamp(surfUV, 0.0, 1.0) * texRect.zw;
          vec4 texColor = texture(uAtlasTex, atlasUV);
          baseColor = mix(baseColor, texColor.rgb, texColor.a);
        }
      }
    }

    // Toon shading
    vec3 color = toonShade(p, normal, rd, baseColor);
    outColor = vec4(color, opacity);
    outNormalId = vec4(normal, hit.y);
  }

  // ── skinOnly overlay: ray-plane intersection for excluded objects ──
  int numObj = int(uNumObjPad.x);
  for (int i = 0; i < MAX_OBJECTS; i++) {
    if (i >= numObj) break;
    if (uEffect[i].w < 0.5) continue; // not skinOnly
    vec4 texRect = uTexRect[i];
    if (texRect.z <= 0.0) continue; // no texture

    vec3 objPos = uPosType[i].xyz;
    vec3 hs = uSizeRadius[i].xyz;
    float frontZ = objPos.z + hs.z;

    // Ray-plane intersection: plane at z = frontZ
    if (abs(rd.z) < 1e-6) continue; // ray parallel to plane
    float t = (frontZ - ro.z) / rd.z;
    if (t < 0.0) continue; // behind camera
    if (hit.y >= 0.0 && t > hit.x) continue; // behind existing hit

    // Hit point on the plane
    vec3 hp = ro + rd * t;
    vec2 local = hp.xy - objPos.xy;

    // Check XY bounds
    if (abs(local.x) > hs.x || abs(local.y) > hs.y) continue;

    // Sample texture
    vec2 surfUV = vec2(local.x / hs.x * 0.5 + 0.5, 1.0 - (local.y / hs.y * 0.5 + 0.5));
    vec2 atlasUV = texRect.xy + clamp(surfUV, 0.0, 1.0) * texRect.zw;
    vec4 texColor = texture(uAtlasTex, atlasUV);

    if (texColor.a > 0.01) {
      outColor = vec4(mix(outColor.rgb, texColor.rgb, texColor.a), 1.0);
      outNormalId = vec4(0.0, 0.0, 1.0, float(i));
    }
  }
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
