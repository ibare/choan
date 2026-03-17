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
layout(location = 0) in vec4 aData; // xy = position, zw = UV
uniform mat4 uViewProj;
uniform float uZ;
out vec2 vUV;
void main() {
  gl_Position = uViewProj * vec4(aData.xy, uZ, 1.0);
  vUV = aData.zw;
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
