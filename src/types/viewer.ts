export type InspectionMode = 'pbr' | 'wireframe' | 'normals' | 'roughness' | 'metalness';

export type CameraPreset = 'free' | 'reset' | 'isometric' | 'front' | 'top';

export type EnvironmentPreset = 'studio' | 'neutral' | 'warm' | 'custom';

export type GroundGridMode = 'all' | 'grid-only' | 'floor-only' | 'none';

export type ToneMappingMode = 'aces' | 'agx' | 'neutral' | 'reinhard' | 'cineon' | 'linear';

export type PostProcessingPreset = 'studio' | 'cinematic' | 'crisp' | 'glow' | 'reset';

export interface PostProcessingConfig {
  enabled: boolean;
  toneMapping: ToneMappingMode;
  brightness: number;
  contrast: number;
  sharpness: number;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  chromaticAberration: number;
  vignetteIntensity: number;
  vignetteOffset: number;
  saturation: number;
  temperature: number;
  tint: number;
  balanceR: number;
  balanceG: number;
  balanceB: number;
}

export interface ShadowConfig {
  enabled: boolean;
  opacity: number;
  blur: number;
  directionalShadow: boolean;
  gridMode: GroundGridMode;
  floorColor: string;
  gridColor: string;
}

export interface EnvironmentConfig {
  useHdriLight: boolean;
  hdriOpacity: number;
  preset: EnvironmentPreset;
  customFileName: string | null;
  exposure: number;
  envIntensity: number;
  showBackground: boolean;
  backgroundBlurriness: number;
  backgroundColor: string;
}

export interface CameraConfig {
  autoRotate: boolean;
  autoRotateSpeed: number;
}

export interface MaterialColorConfig {
  overrideEnabled: boolean;
  baseColor: string;
  customTextureName: string | null;
}

export interface ModelMetadata {
  fileName: string;
  fileSize: number;
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  missingTextures: string[];
  animations: string[];
  dimensions: { x: number; y: number; z: number };
}

export interface AnimationState {
  activeClip: string | null;
  isPlaying: boolean;
  speed: number;
}

export interface LoadedGltfAsset {
  rootFileUrl: string;
  rootFileName: string;
  fileSize: number;
  rawGlbBuffer: ArrayBuffer | null;
  resourceMap: Map<string, string>;
  missingTextures: string[];
}
