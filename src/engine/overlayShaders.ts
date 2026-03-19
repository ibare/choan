// GLSL shader source strings for the overlay renderer.

export const OVERLAY_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPosition;
uniform mat4 uViewProj;
uniform float uZ;
void main() {
  gl_Position = uViewProj * vec4(aPosition, uZ, 1.0);
}
`

export const OVERLAY_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
  fragColor = uColor;
}
`

export const DASH_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uColor;
uniform float uDashTotal;
out vec4 fragColor;
flat in float vStartDist;
in float vDist;
void main() {
  float d = vDist - vStartDist;
  float phase = mod(d, uDashTotal);
  if (phase > uDashTotal * 0.66) discard;
  fragColor = uColor;
}
`

export const DASH_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPosition;
uniform mat4 uViewProj;
uniform float uZ;
uniform vec2 uResolution;
flat out float vStartDist;
out float vDist;
void main() {
  gl_Position = uViewProj * vec4(aPosition, uZ, 1.0);
  // Approximate screen distance for dash pattern
  vec2 screenPos = gl_Position.xy / gl_Position.w * uResolution * 0.5;
  vDist = length(screenPos);
  vStartDist = vDist;
}
`

export const DISC_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec4 aData; // xy = world center, zw = corner offset (-1..1)
uniform mat4 uViewProj;
uniform float uZ;
uniform float uRadius;
out vec2 vUV;
void main() {
  // Billboard: transform center to clip space, then offset in NDC
  vec4 cc = uViewProj * vec4(aData.xy, uZ, 1.0);
  vec4 cr = uViewProj * vec4(aData.x + uRadius, aData.y, uZ, 1.0);
  vec4 cu = uViewProj * vec4(aData.x, aData.y + uRadius, uZ, 1.0);
  float ndcRX = abs(cr.x / cr.w - cc.x / cc.w);
  float ndcRY = abs(cu.y / cu.w - cc.y / cc.w);
  float ndcR = max(ndcRX, ndcRY);
  gl_Position = vec4(cc.xy / cc.w + aData.zw * ndcR, cc.z / cc.w, 1.0);
  vUV = aData.zw * 0.5 + 0.5;
}
`

// Screen-space disc: positions are already in NDC, no viewProj needed
export const DISC_SCREEN_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec4 aData; // xy = NDC position, zw = UV (0..1)
out vec2 vUV;
void main() {
  gl_Position = vec4(aData.xy, 0.0, 1.0);
  vUV = aData.zw;
}
`

// Screen-space rectangle: same vertex layout, no circular clip
export const RECT_SCREEN_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
  fragColor = uColor;
}
`

// Screen-space textured quad: samples a texture instead of flat color
export const TEX_SCREEN_VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec4 aData; // xy = NDC position, zw = UV (0..1)
out vec2 vUV;
void main() {
  gl_Position = vec4(aData.xy, 0.0, 1.0);
  vUV = aData.zw;
}
`

export const TEX_SCREEN_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
out vec4 fragColor;
in vec2 vUV;
void main() {
  vec4 c = texture(uTex, vUV);
  if (c.a < 0.01) discard;
  fragColor = c;
}
`

export const DISC_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
in vec2 vUV;
void main() {
  float d = length(vUV - 0.5) * 2.0;
  if (d > 1.0) discard;
  float aa = 1.0 - smoothstep(0.92, 1.0, d);
  fragColor = vec4(uColor.rgb, uColor.a * aa);
}
`
