// Depth-of-Field post-process shader — Poisson disc bokeh blur

export const DOF_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uColorTex;
uniform sampler2D uDepthTex;
uniform vec2 uTexelSize;
uniform float uFocusDist;
uniform float uAperture;
uniform float uMaxBlurPx;
uniform float uMaxDist;

// 32-sample Poisson disc (unit circle)
const int NUM_SAMPLES = 32;
const vec2 disc[32] = vec2[](
  vec2(-0.9402, -0.0402), vec2(-0.7674,  0.4562),
  vec2(-0.5765, -0.6892), vec2(-0.4473,  0.0171),
  vec2(-0.3547,  0.5936), vec2(-0.2808, -0.3588),
  vec2(-0.1900,  0.2700), vec2(-0.0800, -0.8500),
  vec2(-0.0600,  0.8100), vec2( 0.0500, -0.1300),
  vec2( 0.0834,  0.4352), vec2( 0.1300, -0.5500),
  vec2( 0.2164,  0.7938), vec2( 0.2700, -0.2900),
  vec2( 0.3400,  0.1700), vec2( 0.3832, -0.7600),
  vec2( 0.4500,  0.5300), vec2( 0.5062, -0.0861),
  vec2( 0.5700, -0.4700), vec2( 0.6100,  0.3100),
  vec2( 0.6831,  0.7200), vec2( 0.7200, -0.6300),
  vec2( 0.7700,  0.0500), vec2( 0.8100, -0.2600),
  vec2( 0.8500,  0.4800), vec2( 0.9000, -0.4200),
  vec2( 0.9200,  0.1700), vec2(-0.6300,  0.7400),
  vec2(-0.8200, -0.4700), vec2( 0.4200,  0.9000),
  vec2(-0.1200, -0.4600), vec2( 0.6500, -0.1800)
);

float computeCoC(float depth) {
  float dist = max(depth * uMaxDist, 0.01);
  float coc = abs(uAperture * (uFocusDist - dist) / dist);
  return clamp(coc, 0.0, uMaxBlurPx);
}

void main() {
  float centerDepth = texture(uDepthTex, vUV).r;
  float centerCoC = computeCoC(centerDepth);

  // No blur needed
  if (centerCoC < 0.5) {
    fragColor = texture(uColorTex, vUV);
    return;
  }

  vec3 colorAcc = vec3(0.0);
  float weightAcc = 0.0;

  for (int i = 0; i < NUM_SAMPLES; i++) {
    vec2 offset = disc[i] * centerCoC * uTexelSize;
    vec2 sampleUV = clamp(vUV + offset, 0.0, 1.0);

    vec3 sampleColor = texture(uColorTex, sampleUV).rgb;
    float sampleDepth = texture(uDepthTex, sampleUV).r;
    float sampleCoC = computeCoC(sampleDepth);

    // Scatter-as-gather: foreground leak control
    float w = 1.0;
    if (sampleDepth < centerDepth) {
      float dist = length(disc[i]) * centerCoC;
      w = smoothstep(0.0, 1.0, sampleCoC / (dist + 0.001));
    }

    colorAcc += sampleColor * w;
    weightAcc += w;
  }

  fragColor = vec4(colorAcc / max(weightAcc, 1.0), 1.0);
}
`

// Frustum mask — hybrid approach for accurate object masking AND 3D volume display.
//
// Surface pixels (depth < 0.99):
//   Reconstruct the rendered world position from depth, project into director clip space.
//   Objects straddling the frame edge show pixel-accurate in/out masking (crisp boundary).
//
// Background pixels (depth >= 0.99, empty space):
//   Analytic ray-frustum intersection — checks whether the camera ray passes through the
//   director frustum at any distance. Shows the 3D frustum volume as a bright cone in
//   empty space while preserving the "projector pyramid" appearance.
export const FRUSTUM_MASK_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uColorTex;
uniform sampler2D uDepthTex;
uniform vec2 uResolution;
uniform float uDarken;
uniform float uMaxDist;

uniform vec3 uMainCamPos;
uniform vec3 uMainCamForward;
uniform vec3 uMainCamRight;
uniform vec3 uMainCamUp;
uniform float uMainFovScale;

uniform mat4 uDirViewProj;

// max(|ndcX|, |ndcY|) at parameter t along clip-space ray Q + t*D.
// Returns 2.0 if the point is behind the director camera (w ≤ 0).
float edgeAt(vec4 Q, vec4 D, float t) {
  float w = Q.w + t * D.w;
  if (w <= 0.0) return 2.0;
  return max(abs((Q.x + t * D.x) / w), abs((Q.y + t * D.y) / w));
}

// Updates (minEdge, bestT) if t gives a smaller edge value.
void testCandidate(vec4 Q, vec4 D, float t, float tNear, float tFar,
                   inout float minEdge, inout float bestT) {
  if (t >= tNear && t <= tFar) {
    float e = edgeAt(Q, D, t);
    if (e < minEdge) { minEdge = e; bestT = t; }
  }
}

// Face color from NDC position.
// Single warm-amber hue (projector/spotlight feel) at 4 brightness levels —
// faces are distinguished by intensity, not by hue.
//   Top  (+Y): 100%  Right (+X): 80%  Bottom (−Y): 62%  Left (−X): 46%
vec3 frustumFaceColor(vec2 ndc) {
  float ax = abs(ndc.x), ay = abs(ndc.y);
  const vec3 A = vec3(1.0, 0.78, 0.35);  // warm amber base
  vec3 cx = A * 0.80;                              // left = right (same)
  vec3 cy = ndc.y > 0.0 ? A * 1.00 : A * 0.62;  // top  / bottom
  return mix(cy, cx, smoothstep(-0.15, 0.15, ax - ay));
}

void main() {
  vec3 color = texture(uColorTex, vUV).rgb;
  float depth = texture(uDepthTex, vUV).r;

  // Ray direction (matches raymarch pass)
  vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / uResolution.y;
  vec3 rd = normalize(uMainCamForward + uv.x * uMainFovScale * uMainCamRight + uv.y * uMainFovScale * uMainCamUp);

  if (depth < 0.99) {
    // ── Surface pixel: depth-based per-surface masking ──
    // Reconstruct the actual rendered point and test it against the frustum.
    // Gives a crisp rectangular cut exactly at the camera frame boundary.
    vec3 worldPos = uMainCamPos + rd * depth * uMaxDist;
    vec4 clip = uDirViewProj * vec4(worldPos, 1.0);
    float edge = (clip.w <= 0.0) ? 2.0 : max(abs(clip.x / clip.w), abs(clip.y / clip.w));
    float factor = mix(1.0, uDarken, smoothstep(0.97, 1.03, edge));
    fragColor = vec4(color * factor, 1.0);

  } else {
    // ── Background pixel: analytic ray-frustum intersection ──
    // Finds the minimum NDC extent over all t ∈ [tNear, tFar].
    // ndcX(t) = (Q.x + t·D.x) / (Q.w + t·D.w) is a monotonic rational function,
    // so its minimum |value| and the envelope min(|ndcX|, |ndcY|) occur at a
    // finite set of candidate t values (zero-crossings + envelope crossings).
    vec4 Q = uDirViewProj * vec4(uMainCamPos, 1.0);
    vec4 D = uDirViewProj * vec4(rd, 0.0);

    float tNear = 0.1;
    float tFar  = uMaxDist;

    // Restrict to director camera's front hemisphere (clip.w > 0)
    if (abs(D.w) > 1e-6) {
      float tW = -Q.w / D.w;
      if (D.w < 0.0) tFar  = min(tFar,  tW);
      else           tNear = max(tNear, tW);
    } else if (Q.w <= 0.0) {
      tNear = tFar + 1.0;  // empty interval → entirely behind director camera
    }

    // ── minEdge: how "inside" the frustum the ray gets (for soft boundary fade) ──
    float minEdge = 2.0;
    float bestT = tNear;
    if (tNear < tFar) {
      minEdge = edgeAt(Q, D, tNear); bestT = tNear;
      { float e = edgeAt(Q, D, tFar); if (e < minEdge) { minEdge = e; bestT = tFar; } }
      if (abs(D.x) > 1e-6)       testCandidate(Q, D, -Q.x / D.x,               tNear, tFar, minEdge, bestT);
      if (abs(D.y) > 1e-6)       testCandidate(Q, D, -Q.y / D.y,               tNear, tFar, minEdge, bestT);
      if (abs(D.x - D.y) > 1e-6) testCandidate(Q, D,  (Q.y - Q.x) / (D.x - D.y), tNear, tFar, minEdge, bestT);
      if (abs(D.x + D.y) > 1e-6) testCandidate(Q, D, -(Q.x + Q.y) / (D.x + D.y), tNear, tFar, minEdge, bestT);
    }

    // ── entryT: the t at which the ray enters the frustum (Liang-Barsky) ──
    // The face whose entry-t is the LARGEST is the face the ray passes through,
    // so its color dominates. Using the entry NDC (always on a face boundary)
    // gives accurate per-face coloring instead of interior-point blending.
    float entryT = tNear;
    // Right face (ndcX = +1): entering when D.x − D.w < 0
    float dr = D.x - D.w;
    if (dr < -1e-6) { float t = (Q.w - Q.x) / dr;  if (t >= tNear && t < tFar) entryT = max(entryT, t); }
    // Left face (ndcX = −1): entering when D.x + D.w > 0
    float dl = D.x + D.w;
    if (dl >  1e-6) { float t = -(Q.w + Q.x) / dl; if (t >= tNear && t < tFar) entryT = max(entryT, t); }
    // Top face (ndcY = +1): entering when D.y − D.w < 0
    float dyt = D.y - D.w;
    if (dyt < -1e-6) { float t = (Q.w - Q.y) / dyt;  if (t >= tNear && t < tFar) entryT = max(entryT, t); }
    // Bottom face (ndcY = −1): entering when D.y + D.w > 0
    float dyb = D.y + D.w;
    if (dyb >  1e-6) { float t = -(Q.w + Q.y) / dyb; if (t >= tNear && t < tFar) entryT = max(entryT, t); }

    float wEntry = Q.w + entryT * D.w;
    vec2 entryNDC = (wEntry > 0.001) ? vec2(Q.x + entryT * D.x, Q.y + entryT * D.y) / wEntry : vec2(0.0);

    // Blend: darken (outside) → face-colored light (inside)
    float inFactor = 1.0 - smoothstep(0.85, 1.15, minEdge);
    vec3 tint = mix(vec3(uDarken), frustumFaceColor(entryNDC), inFactor);
    fragColor = vec4(color * tint, 1.0);
  }
}
`
