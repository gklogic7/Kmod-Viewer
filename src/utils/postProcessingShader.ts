import * as THREE from 'three';
import {
  PostProcessingConfig,
  PostProcessingPreset,
  ToneMappingMode,
} from '../types/viewer';

export const DEFAULT_POST_PROCESSING_CONFIG: PostProcessingConfig = {
  enabled: true,
  toneMapping: 'aces',
  brightness: 0.0,
  contrast: 0.0,
  sharpness: 0.15,
  bloomEnabled: false,
  bloomStrength: 0.35,
  bloomRadius: 0.4,
  bloomThreshold: 0.82,
  chromaticAberration: 0.0,
  vignetteIntensity: 0.0,
  vignetteOffset: 0.95,
  saturation: 1.0,
  temperature: 0.0,
  tint: 0.0,
  balanceR: 1.0,
  balanceG: 1.0,
  balanceB: 1.0,
};

export function getPostProcessingPreset(preset: PostProcessingPreset): PostProcessingConfig {
  switch (preset) {
    case 'studio':
      return {
        ...DEFAULT_POST_PROCESSING_CONFIG,
        enabled: true,
        toneMapping: 'aces',
        sharpness: 0.25,
        contrast: 0.06,
        vignetteIntensity: 0.22,
        vignetteOffset: 1.0,
      };
    case 'cinematic':
      return {
        ...DEFAULT_POST_PROCESSING_CONFIG,
        enabled: true,
        toneMapping: 'agx',
        brightness: -0.02,
        contrast: 0.18,
        sharpness: 0.35,
        bloomEnabled: true,
        bloomStrength: 0.42,
        bloomThreshold: 0.78,
        bloomRadius: 0.5,
        chromaticAberration: 0.0035,
        vignetteIntensity: 0.55,
        vignetteOffset: 0.92,
        saturation: 1.08,
        temperature: 0.12,
        tint: -0.04,
        balanceR: 1.04,
        balanceG: 1.0,
        balanceB: 0.96,
      };
    case 'crisp':
      return {
        ...DEFAULT_POST_PROCESSING_CONFIG,
        enabled: true,
        toneMapping: 'neutral',
        brightness: 0.02,
        contrast: 0.14,
        sharpness: 0.85,
        bloomEnabled: false,
        chromaticAberration: 0.0,
        vignetteIntensity: 0.15,
        saturation: 1.05,
      };
    case 'glow':
      return {
        ...DEFAULT_POST_PROCESSING_CONFIG,
        enabled: true,
        toneMapping: 'aces',
        brightness: 0.03,
        contrast: 0.12,
        sharpness: 0.3,
        bloomEnabled: true,
        bloomStrength: 0.95,
        bloomThreshold: 0.62,
        bloomRadius: 0.65,
        chromaticAberration: 0.005,
        vignetteIntensity: 0.45,
        saturation: 1.22,
      };
    case 'reset':
    default:
      return {
        ...DEFAULT_POST_PROCESSING_CONFIG,
        sharpness: 0.0,
      };
  }
}

export function mapToneMappingConstant(mode: ToneMappingMode): THREE.ToneMapping {
  switch (mode) {
    case 'agx':
      return THREE.AgXToneMapping;
    case 'neutral':
      return THREE.NeutralToneMapping;
    case 'reinhard':
      return THREE.ReinhardToneMapping;
    case 'cineon':
      return THREE.CineonToneMapping;
    case 'linear':
      return THREE.LinearToneMapping;
    case 'aces':
    default:
      return THREE.ACESFilmicToneMapping;
  }
}

/**
 * Unified single-pass GLSL post-processing shader executing:
 * - 5-tap Spatial Unsharp Mask (Sharpness)
 * - Radial Chromatic Aberration
 * - RGB Channel Color Balance, Temperature (Warm/Cool), Tint (Green/Magenta), Saturation
 * - Brightness & Contrast
 * - Smooth Radial Vignette
 */
export const KModGradingShader = {
  name: 'KModGradingShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1 / 1024, 1 / 768) },
    brightness: { value: 0.0 },
    contrast: { value: 0.0 },
    sharpness: { value: 0.0 },
    chromaticAberration: { value: 0.0 },
    vignetteIntensity: { value: 0.0 },
    vignetteOffset: { value: 0.95 },
    saturation: { value: 1.0 },
    temperature: { value: 0.0 },
    tint: { value: 0.0 },
    balanceRGB: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float brightness;
    uniform float contrast;
    uniform float sharpness;
    uniform float chromaticAberration;
    uniform float vignetteIntensity;
    uniform float vignetteOffset;
    uniform float saturation;
    uniform float temperature;
    uniform float tint;
    uniform vec3 balanceRGB;
    varying vec2 vUv;

    vec3 sampleWithCA(vec2 uv, float caAmount) {
      if (caAmount <= 0.00001) {
        return texture2D(tDiffuse, uv).rgb;
      }
      vec2 dir = uv - vec2(0.5);
      float dist = length(dir);
      vec2 offset = dir * dist * caAmount * 2.2;
      float r = texture2D(tDiffuse, clamp(uv - offset, 0.001, 0.999)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, clamp(uv + offset, 0.001, 0.999)).b;
      return vec3(r, g, b);
    }

    void main() {
      vec4 baseSample = texture2D(tDiffuse, vUv);
      vec3 color = sampleWithCA(vUv, chromaticAberration);

      // 1. 5-Tap Spatial Sharpness (Unsharp Convolution)
      if (sharpness > 0.001) {
        vec3 n = texture2D(tDiffuse, clamp(vUv + vec2(0.0, resolution.y), 0.0, 1.0)).rgb;
        vec3 s = texture2D(tDiffuse, clamp(vUv - vec2(0.0, resolution.y), 0.0, 1.0)).rgb;
        vec3 e = texture2D(tDiffuse, clamp(vUv + vec2(resolution.x, 0.0), 0.0, 1.0)).rgb;
        vec3 w = texture2D(tDiffuse, clamp(vUv - vec2(resolution.x, 0.0), 0.0, 1.0)).rgb;
        vec3 blurNeighbors = 0.25 * (n + s + e + w);
        color = color + (color - blurNeighbors) * (sharpness * 1.65);
      }

      // 2. RGB Channel Color Balance
      color *= balanceRGB;

      // 3. Color Temperature (Warm / Cool) & Tint (Green / Magenta)
      color.r += temperature * 0.08;
      color.b -= temperature * 0.08;
      color.g -= tint * 0.06;
      color.r += tint * 0.03;
      color.b += tint * 0.03;

      // 4. Saturation (Luma-preserving)
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);

      // 5. Brightness & Contrast
      color += brightness;
      float contrastFactor = max(0.0, 1.0 + contrast);
      color = (color - 0.5) * contrastFactor + 0.5;

      // 6. Smooth Radial Vignette
      if (vignetteIntensity > 0.001) {
        vec2 centered = (vUv - vec2(0.5)) * vec2(1.35);
        float d = length(centered);
        float vig = smoothstep(vignetteOffset * 0.45, vignetteOffset * 1.15, d);
        color *= clamp(1.0 - vig * vignetteIntensity, 0.0, 1.0);
      }

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), baseSample.a);
    }
  `,
};
