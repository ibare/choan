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
