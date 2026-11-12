import {
  AnimationState,
  CameraConfig,
  EnvironmentConfig,
  MaterialColorConfig,
  PostProcessingConfig,
  ShadowConfig,
} from '../types/viewer';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize))));
  }
  return btoa(chunks.join(''));
}

export function downloadStandaloneOfflineHtml(
  shadowConfig: ShadowConfig,
  envConfig: EnvironmentConfig,
  cameraConfig: CameraConfig,
  materialColorConfig: MaterialColorConfig,
  postProcessingConfig: PostProcessingConfig,
  animationState: AnimationState,
  activeModelName?: string | null,
  rawGlbBuffer?: ArrayBuffer | null
): void {
  const embeddedBase64 = rawGlbBuffer ? arrayBufferToBase64(rawGlbBuffer) : '';
  const safeModelName = (activeModelName || '').replace(/[^a-zA-Z0-9._-]/g, '_');

  const htmlContent = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>KMod viewer — Standalone Edition</title>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body {
      width: 100%; height: 100%; height: 100dvh; margin: 0; padding: 0;
      overflow: hidden; background: ${envConfig.backgroundColor}; color: #e5e5e5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
    }
    header {
      position: fixed; top: 0; left: 0; right: 0; height: 52px;
      background: #353535; display: flex; align-items: center;
      justify-content: space-between; padding: 0 24px; z-index: 20;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .brand { font-size: 20px; font-weight: 500; color: #f0f0f0; letter-spacing: -0.01em; white-space: nowrap; }
    .top-actions { display: flex; align-items: center; gap: 8px; }
    .btn {
      background: #252525; color: #e5e5e5; border: 1px solid rgba(255,255,255,0.12);
      padding: 5px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;
      white-space: nowrap;
    }
    .btn:hover { background: #2f2f2f; }
    .btn.active { background: #3b82f6; border-color: #3b82f6; color: #fff; }
    #viewport { position: fixed; inset: 0; top: 52px; bottom: 28px; touch-action: none; }
    #dropzone-wrap {
      position: fixed; inset: 0; top: 52px; bottom: 28px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #191919; z-index: 15; padding: 20px;
    }
    #dropzone-wrap.hidden { display: none; }
    .drop-card {
      width: min(475px, 90vw); height: min(215px, 42vh);
      background: #252525; border-radius: 8px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 24px; gap: 8px;
      border: 1px solid rgba(255,255,255,0.04);
      box-shadow: 0 12px 32px rgba(0,0,0,0.28);
      transition: border-color 0.15s ease, transform 0.15s ease;
      cursor: pointer;
    }
    .drop-card.dragover { border-color: #3b82f6; transform: scale(1.01); }
    .drop-title { font-size: clamp(18px, 3.5vw, 23px); color: #9e9e9e; font-weight: 400; }
    .drop-sub { font-size: 11px; color: #6d6d6d; font-family: monospace; }
    .choose-row {
      margin-top: 34px; display: inline-flex; align-items: center; gap: 8px;
      color: #9e9e9e; font-size: 16px; cursor: pointer; background: none; border: none;
    }
    .choose-row:hover { color: #e5e5e5; }
    #dock-wrapper {
      position: fixed; bottom: 34px; left: 50%; transform: translateX(-50%);
      width: min(1020px, 96vw); z-index: 18; display: none;
      flex-direction: column; align-items: center; pointer-events: none;
    }
    #dock-wrapper.visible { display: flex; }
    #btn-minimize-dock {
      pointer-events: auto; background: #222222; color: #b5b5b5;
      border: 1px solid rgba(255,255,255,0.1); border-bottom: none;
      border-radius: 8px 8px 0 0; padding: 4px 14px; font-size: 11px;
      cursor: pointer; white-space: nowrap;
    }
    #btn-minimize-dock:hover { color: #ffffff; }
    #dock {
      pointer-events: auto; width: 100%; background: #202020;
      border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
      padding: 10px 14px; display: flex; flex-direction: column; gap: 8px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.45);
    }
    #dock.minimized { display: none; }
    .dock-tabs {
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 6px; gap: 8px;
      overflow-x: auto;
    }
    .tab-group { display: flex; gap: 4px; background: #171717; padding: 3px; border-radius: 7px; }
    .tab-btn {
      background: transparent; color: #9e9e9e; border: none; padding: 4px 10px;
      border-radius: 5px; font-size: 11px; font-weight: 500; cursor: pointer; white-space: nowrap;
    }
    .tab-btn.active { background: #323232; color: #fff; }
    .tab-pane { display: none; flex-direction: column; gap: 7px; }
    .tab-pane.active { display: flex; }
    .dock-row {
      display: flex; flex-wrap: wrap; align-items: center;
      justify-content: space-between; gap: 10px;
    }
    .control-group {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      font-size: 11px; color: #bdbdbd;
    }
    input[type="range"] { width: 68px; accent-color: #3b82f6; cursor: pointer; }
    input[type="color"] {
      width: 22px; height: 22px; border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px; background: transparent; cursor: pointer; padding: 0;
    }
    select {
      background: #171717; color: #e5e5e5; border: 1px solid rgba(255,255,255,0.14);
      border-radius: 5px; padding: 3px 6px; font-size: 11px;
    }
    footer {
      position: fixed; bottom: 0; left: 0; right: 0; height: 28px;
      background: #191919; display: flex; align-items: center; justify-content: flex-end;
      padding: 0 16px; font-size: 12px; color: #8c8c8c; gap: 10px; z-index: 20;
      font-family: monospace;
    }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.174.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.174.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <header>
    <div class="brand">KMod viewer</div>
    <div class="top-actions">
      <button class="btn" id="btn-open-model">Load 3D Model</button>
      <button class="btn" id="btn-open-tex">Apply Texture</button>
      <button class="btn" id="btn-open-hdr">Load .HDR / .EXR</button>
    </div>
  </header>

  <div id="viewport"></div>

  <div id="dropzone-wrap">
    <div class="drop-card" id="drop-card">
      <span class="drop-title">Drag glTF 2.0 file or folder here</span>
      <span class="drop-sub">Supports animated .glb · .gltf · .usdz · .fbx · .obj · .stl · .ply · .dae · .3mf</span>
    </div>
    <button class="choose-row" id="btn-choose-file">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <span>Choose file</span>
    </button>
  </div>

  <div id="dock-wrapper">
    <button id="btn-minimize-dock">▾ Minimize Controls</button>
    <div id="dock">
      <div class="dock-tabs">
        <div class="tab-group">
          <button class="tab-btn active" data-tab="tab-scene">Scene, Grid &amp; HDRI</button>
          <button class="tab-btn" data-tab="tab-anim" id="btn-tab-anim">Animation &amp; Rig</button>
          <button class="tab-btn" data-tab="tab-postfx">Post-FX &amp; Bloom</button>
          <button class="tab-btn" data-tab="tab-colorbalance">Color Balance &amp; Tone Map</button>
        </div>
        <div class="control-group">
          <label><input type="checkbox" id="chk-autorotate" ${cameraConfig.autoRotate ? 'checked' : ''} /> Auto-Rotate</label>
          <label><input type="checkbox" id="chk-wireframe" /> Wireframe</label>
          <button class="btn" id="btn-reset-cam">Reset View</button>
        </div>
      </div>

      <!-- Tab 1: Scene, Shadow, Grid, HDRI & Custom Colors -->
      <div class="tab-pane active" id="tab-scene">
        <div class="dock-row">
          <div class="control-group">
            <label><input type="checkbox" id="chk-shadow" ${shadowConfig.enabled ? 'checked' : ''} /> Shadow</label>
            <span>Opacity</span>
            <input type="range" id="rng-shadow-opacity" min="0" max="1" step="0.02" value="${shadowConfig.opacity}" />
            <span>Blur</span>
            <input type="range" id="rng-shadow-blur" min="0.2" max="3.5" step="0.1" value="${shadowConfig.blur}" />
            <span>Grid</span>
            <select id="sel-grid-mode">
              <option value="all" ${shadowConfig.gridMode === 'all' ? 'selected' : ''}>All (Grid + Floor)</option>
              <option value="grid-only" ${shadowConfig.gridMode === 'grid-only' ? 'selected' : ''}>Grid Lines</option>
              <option value="floor-only" ${shadowConfig.gridMode === 'floor-only' ? 'selected' : ''}>Tiled Floor</option>
              <option value="none" ${shadowConfig.gridMode === 'none' ? 'selected' : ''}>Off</option>
            </select>
          </div>
          <div class="control-group">
            <label><input type="checkbox" id="chk-hdri-light" ${envConfig.useHdriLight ? 'checked' : ''} /> HDRI Light</label>
            <span>HDRI Opacity</span>
            <input type="range" id="rng-hdri-opacity" min="0" max="2" step="0.05" value="${envConfig.hdriOpacity}" />
            <span>Exposure</span>
            <input type="range" id="rng-exposure" min="0.2" max="2.5" step="0.05" value="${envConfig.exposure}" />
          </div>
        </div>
        <div class="dock-row" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 5px;">
          <div class="control-group">
            <span>Backdrop</span>
            <input type="color" id="col-bg" value="${envConfig.backgroundColor}" />
            <span>Floor</span>
            <input type="color" id="col-floor" value="${shadowConfig.floorColor}" />
            <span>Grid</span>
            <input type="color" id="col-grid" value="${shadowConfig.gridColor}" />
            <label><input type="checkbox" id="chk-model-color" ${materialColorConfig.overrideEnabled ? 'checked' : ''} /> Model Color</label>
            <input type="color" id="col-model" value="${materialColorConfig.baseColor}" />
          </div>
        </div>
      </div>

      <!-- Tab 2: Animation & Rigging Studio -->
      <div class="tab-pane" id="tab-anim">
        <div class="dock-row">
          <div class="control-group">
            <button class="btn active" id="btn-anim-play">${animationState.isPlaying ? 'Pause' : 'Play'}</button>
            <button class="btn" id="btn-anim-rewind">Rewind</button>
            <span>Clip</span>
            <select id="sel-anim-clip">
              <option value="">No animations</option>
            </select>
            <span>Timeline</span>
            <input type="range" id="rng-anim-time" min="0" max="1" step="0.01" value="0" style="width:120px;" />
            <span id="lbl-anim-time" style="font-family:monospace; width:74px;">0.0s / 0.0s</span>
          </div>
          <div class="control-group">
            <span>Speed</span>
            <input type="range" id="rng-anim-speed" min="0.1" max="3.0" step="0.1" value="${animationState.speed}" />
            <span>Loop</span>
            <select id="sel-anim-loop">
              <option value="repeat" ${animationState.loopMode === 'repeat' ? 'selected' : ''}>Repeat</option>
              <option value="once" ${animationState.loopMode === 'once' ? 'selected' : ''}>Play Once</option>
              <option value="pingpong" ${animationState.loopMode === 'pingpong' ? 'selected' : ''}>Ping-Pong</option>
            </select>
            <label><input type="checkbox" id="chk-skeleton" ${animationState.showSkeleton ? 'checked' : ''} /> Skeleton</label>
          </div>
        </div>
      </div>

      <!-- Tab 3: Post-FX Optics & Bloom -->
      <div class="tab-pane" id="tab-postfx">
        <div class="dock-row">
          <div class="control-group">
            <label><input type="checkbox" id="chk-postfx" ${postProcessingConfig.enabled ? 'checked' : ''} /> Post-FX On</label>
            <span>Presets:</span>
            <button class="btn" data-preset="studio">Studio</button>
            <button class="btn" data-preset="cinematic">Cinematic</button>
            <button class="btn" data-preset="crisp">Crisp</button>
            <button class="btn" data-preset="glow">Glow</button>
            <button class="btn" data-preset="reset">Reset</button>
          </div>
          <div class="control-group">
            <span>Brightness</span>
            <input type="range" id="rng-brightness" min="-0.5" max="0.5" step="0.01" value="${postProcessingConfig.brightness}" />
            <span>Contrast</span>
            <input type="range" id="rng-contrast" min="-0.5" max="0.8" step="0.02" value="${postProcessingConfig.contrast}" />
            <span>Sharpness</span>
            <input type="range" id="rng-sharpness" min="0" max="2" step="0.05" value="${postProcessingConfig.sharpness}" />
          </div>
        </div>
        <div class="dock-row" style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 5px;">
          <div class="control-group">
            <label><input type="checkbox" id="chk-bloom" ${postProcessingConfig.bloomEnabled ? 'checked' : ''} /> Bloom</label>
            <span>Strength</span>
            <input type="range" id="rng-bloom-str" min="0" max="2.5" step="0.05" value="${postProcessingConfig.bloomStrength}" />
            <span>Threshold</span>
            <input type="range" id="rng-bloom-thresh" min="0" max="1" step="0.02" value="${postProcessingConfig.bloomThreshold}" />
            <span>Radius</span>
            <input type="range" id="rng-bloom-rad" min="0" max="1" step="0.02" value="${postProcessingConfig.bloomRadius}" />
          </div>
          <div class="control-group">
            <span>Chromatic</span>
            <input type="range" id="rng-chroma" min="0" max="0.02" step="0.0005" value="${postProcessingConfig.chromaticAberration}" />
            <span>Vignette</span>
            <input type="range" id="rng-vig-int" min="0" max="1.5" step="0.05" value="${postProcessingConfig.vignetteIntensity}" />
            <span>Vig Offset</span>
            <input type="range" id="rng-vig-off" min="0.3" max="1.5" step="0.05" value="${postProcessingConfig.vignetteOffset}" />
          </div>
        </div>
      </div>

      <!-- Tab 4: Color Balance & Tone Mapping -->
      <div class="tab-pane" id="tab-colorbalance">
        <div class="dock-row">
          <div class="control-group">
            <span>Tone Mapping</span>
            <select id="sel-tonemap">
              <option value="aces" ${postProcessingConfig.toneMapping === 'aces' ? 'selected' : ''}>ACES Filmic</option>
              <option value="agx" ${postProcessingConfig.toneMapping === 'agx' ? 'selected' : ''}>AgX</option>
              <option value="neutral" ${postProcessingConfig.toneMapping === 'neutral' ? 'selected' : ''}>Neutral</option>
              <option value="reinhard" ${postProcessingConfig.toneMapping === 'reinhard' ? 'selected' : ''}>Reinhard</option>
              <option value="cineon" ${postProcessingConfig.toneMapping === 'cineon' ? 'selected' : ''}>Cineon</option>
              <option value="linear" ${postProcessingConfig.toneMapping === 'linear' ? 'selected' : ''}>Linear</option>
            </select>
            <span>Saturation</span>
            <input type="range" id="rng-sat" min="0" max="2" step="0.02" value="${postProcessingConfig.saturation}" />
            <span>Temp</span>
            <input type="range" id="rng-temp" min="-1" max="1" step="0.02" value="${postProcessingConfig.temperature}" />
            <span>Tint</span>
            <input type="range" id="rng-tint" min="-1" max="1" step="0.02" value="${postProcessingConfig.tint}" />
          </div>
          <div class="control-group">
            <span style="color:#fca5a5;">R</span>
            <input type="range" id="rng-bal-r" min="0.5" max="1.5" step="0.01" value="${postProcessingConfig.balanceR}" />
            <span style="color:#6ee7b7;">G</span>
            <input type="range" id="rng-bal-g" min="0.5" max="1.5" step="0.01" value="${postProcessingConfig.balanceG}" />
            <span style="color:#7dd3fc;">B</span>
            <input type="range" id="rng-bal-b" min="0.5" max="1.5" step="0.01" value="${postProcessingConfig.balanceB}" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <input type="file" id="file-input" multiple accept=".gltf,.glb,.usdz,.usda,.fbx,.obj,.mtl,.stl,.ply,.dae,.3mf,.bin,.png,.jpg,.jpeg,.webp,.hdr,.exr" style="display:none" />
  <input type="file" id="tex-input" accept=".png,.jpg,.jpeg,.webp" style="display:none" />
  <input type="file" id="hdr-input" accept=".hdr,.exr" style="display:none" />

  <footer>
    <span>KMod viewer</span>
    <span>|</span>
    <span>three.js webgl · animations · multi-format · post-fx</span>
    <span>|</span>
    <span>press H to minimize controls</span>
  </footer>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { USDZLoader } from 'three/addons/loaders/USDZLoader.js';
    import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
    import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
    import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
    import { STLLoader } from 'three/addons/loaders/STLLoader.js';
    import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
    import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
    import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
    import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
    import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
    import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
    import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
    import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
    import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
    import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
    import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

    const KModGradingShader = {
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uBrightness: { value: ${postProcessingConfig.brightness} },
        uContrast: { value: ${postProcessingConfig.contrast} },
        uSharpness: { value: ${postProcessingConfig.sharpness} },
        uChromaticAberration: { value: ${postProcessingConfig.chromaticAberration} },
        uVignetteIntensity: { value: ${postProcessingConfig.vignetteIntensity} },
        uVignetteOffset: { value: ${postProcessingConfig.vignetteOffset} },
        uSaturation: { value: ${postProcessingConfig.saturation} },
        uTemperature: { value: ${postProcessingConfig.temperature} },
        uTint: { value: ${postProcessingConfig.tint} },
        uColorBalance: { value: new THREE.Vector3(${postProcessingConfig.balanceR}, ${postProcessingConfig.balanceG}, ${postProcessingConfig.balanceB}) }
      },
      vertexShader: \`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      \`,
      fragmentShader: \`
        uniform sampler2D tDiffuse;
        uniform vec2 uResolution;
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uSharpness;
        uniform float uChromaticAberration;
        uniform float uVignetteIntensity;
        uniform float uVignetteOffset;
        uniform float uSaturation;
        uniform float uTemperature;
        uniform float uTint;
        uniform vec3 uColorBalance;
        varying vec2 vUv;

        vec3 sampleWithChromaticAndSharpness(vec2 uv) {
          vec2 texel = 1.0 / max(uResolution, vec2(1.0));
          vec2 dir = uv - vec2(0.5);
          vec2 caOffset = dir * uChromaticAberration;
          float r = texture2D(tDiffuse, clamp(uv + caOffset, 0.0, 1.0)).r;
          float g = texture2D(tDiffuse, uv).g;
          float b = texture2D(tDiffuse, clamp(uv - caOffset, 0.0, 1.0)).b;
          vec3 center = vec3(r, g, b);
          if (uSharpness > 0.001) {
            vec3 n = texture2D(tDiffuse, clamp(uv + vec2(0.0, texel.y), 0.0, 1.0)).rgb;
            vec3 s = texture2D(tDiffuse, clamp(uv - vec2(0.0, texel.y), 0.0, 1.0)).rgb;
            vec3 e = texture2D(tDiffuse, clamp(uv + vec2(texel.x, 0.0), 0.0, 1.0)).rgb;
            vec3 w = texture2D(tDiffuse, clamp(uv - vec2(texel.x, 0.0), 0.0, 1.0)).rgb;
            vec3 blur = 0.25 * (n + s + e + w);
            center = center + (center - blur) * uSharpness * 1.65;
          }
          return max(center, vec3(0.0));
        }

        void main() {
          vec4 baseSample = texture2D(tDiffuse, vUv);
          vec3 color = sampleWithChromaticAndSharpness(vUv);
          color *= uColorBalance;
          color.r += uTemperature * 0.14;
          color.b -= uTemperature * 0.14;
          color.g += uTint * 0.12;
          color.r -= uTint * 0.05;
          color.b -= uTint * 0.05;
          float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
          color = mix(vec3(luma), color, uSaturation);
          color = (color - 0.5) * max(0.0, 1.0 + uContrast) + 0.5 + uBrightness;
          if (uVignetteIntensity > 0.001) {
            float dist = distance(vUv, vec2(0.5)) * 1.41421356;
            float vig = smoothstep(uVignetteOffset, uVignetteOffset - 0.65, dist * (0.55 + uVignetteIntensity * 0.65));
            color *= clamp(vig, 0.0, 1.0);
          }
          gl_FragColor = vec4(clamp(color, 0.0, 1.0), baseSample.a);
        }
      \`
    };

    function mapToneMapping(mode) {
      switch (mode) {
        case 'aces': return THREE.ACESFilmicToneMapping;
        case 'agx': return THREE.AgXToneMapping;
        case 'neutral': return THREE.NeutralToneMapping;
        case 'reinhard': return THREE.ReinhardToneMapping;
        case 'cineon': return THREE.CineonToneMapping;
        case 'linear':
        default: return THREE.LinearToneMapping;
      }
    }

    function mapLoopStyle(mode) {
      if (mode === 'once') return THREE.LoopOnce;
      if (mode === 'pingpong') return THREE.LoopPingPong;
      return THREE.LoopRepeat;
    }

    const container = document.getElementById('viewport');
    const dropzoneWrap = document.getElementById('dropzone-wrap');
    const dockWrapper = document.getElementById('dock-wrapper');
    const dock = document.getElementById('dock');
    const btnMinimizeDock = document.getElementById('btn-minimize-dock');

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = mapToneMapping('${postProcessingConfig.toneMapping}');
    renderer.toneMappingExposure = ${envConfig.exposure};
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('${envConfig.backgroundColor}');

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(2.5, 1.8, 3.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = ${cameraConfig.autoRotate};
    controls.autoRotateSpeed = ${cameraConfig.autoRotateSpeed};

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      ${postProcessingConfig.bloomStrength},
      ${postProcessingConfig.bloomRadius},
      ${postProcessingConfig.bloomThreshold}
    );
    bloomPass.enabled = ${postProcessingConfig.enabled && postProcessingConfig.bloomEnabled};
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    const gradingPass = new ShaderPass(KModGradingShader);
    gradingPass.enabled = ${postProcessingConfig.enabled};
    composer.addPass(gradingPass);

    let postFxEnabled = ${postProcessingConfig.enabled};

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    let activeEnvTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = ${envConfig.useHdriLight} ? activeEnvTex : null;
    if ('environmentIntensity' in scene) scene.environmentIntensity = ${envConfig.hdriOpacity};

    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.85);
    keyLight.position.set(4.5, 7.5, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.8);
    rimLight.position.set(-4, 4.5, -4.5);
    scene.add(rimLight);

    function makeGridTex(mode, floorColor, gridColor) {
      const size = 1024;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      if (mode === 'none') return new THREE.CanvasTexture(c);
      const showFloor = mode === 'all' || mode === 'floor-only';
      const showGrid = mode === 'all' || mode === 'grid-only';
      if (showFloor) {
        ctx.fillStyle = floorColor;
        ctx.fillRect(0, 0, size, size);
        const cells = 16, cs = size / cells;
        for (let y = 0; y < cells; y++) {
          for (let x = 0; x < cells; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)';
            ctx.fillRect(x * cs, y * cs, cs, cs);
          }
        }
      }
      if (showGrid) {
        const subs = 32, step = size / subs;
        ctx.strokeStyle = gridColor;
        ctx.globalAlpha = showFloor ? 0.32 : 0.42;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= subs; i++) {
          if (i % 4 === 0) continue;
          const p = Math.round(i * step) + 0.5;
          ctx.moveTo(p, 0); ctx.lineTo(p, size);
          ctx.moveTo(0, p); ctx.lineTo(size, p);
        }
        ctx.stroke();
        ctx.globalAlpha = showFloor ? 0.72 : 0.85;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= subs; i += 4) {
          const p = Math.round(i * step);
          ctx.moveTo(p, 0); ctx.lineTo(p, size);
          ctx.moveTo(0, p); ctx.lineTo(size, p);
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
      ctx.globalCompositeOperation = 'destination-in';
      const half = size / 2;
      const g = ctx.createRadialGradient(half, half, half * 0.15, half, half, half * 0.98);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.92)');
      g.addColorStop(0.82, 'rgba(0,0,0,0.38)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    function makeShadowTex(blur) {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 512;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      const stop = Math.max(0.05, Math.min(0.45, 0.32 / blur));
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(stop, 'rgba(0,0,0,0.65)');
      g.addColorStop(0.75, 'rgba(0,0,0,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 512, 512);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    const gridMat = new THREE.MeshBasicMaterial({
      map: makeGridTex('${shadowConfig.gridMode}', '${shadowConfig.floorColor}', '${shadowConfig.gridColor}'),
      transparent: true,
      depthWrite: false
    });
    const gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), gridMat);
    gridPlane.rotation.x = -Math.PI / 2;
    gridPlane.position.y = -0.002;
    gridPlane.visible = '${shadowConfig.gridMode}' !== 'none';
    scene.add(gridPlane);

    const contactMat = new THREE.MeshBasicMaterial({
      map: makeShadowTex(${shadowConfig.blur}),
      transparent: true,
      depthWrite: false,
      opacity: ${shadowConfig.opacity},
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const contactPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), contactMat);
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.y = 0.003;
    contactPlane.visible = ${shadowConfig.enabled};
    scene.add(contactPlane);

    let activeModel = null;
    let skeletonHelper = null;
    let mixer = null;
    let clips = [];
    let activeActions = [];
    let activeDuration = 0;
    let animPlaying = ${animationState.isPlaying};
    let animSpeed = ${animationState.speed};
    const clock = new THREE.Clock();

    function applyHdriOpacityAndLight() {
      const useHdri = document.getElementById('chk-hdri-light').checked;
      const opacity = parseFloat(document.getElementById('rng-hdri-opacity').value);
      scene.environment = useHdri ? activeEnvTex : null;
      if ('environmentIntensity' in scene) scene.environmentIntensity = useHdri ? opacity : 0;
      if (activeModel) {
        activeModel.traverse((o) => {
          if (o.isMesh && o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => {
              if ('envMapIntensity' in m) {
                m.envMapIntensity = useHdri ? opacity : 0;
                m.needsUpdate = true;
              }
            });
          }
        });
      }
    }

    function applyModelColorOverride() {
      if (!activeModel) return;
      const enabled = document.getElementById('chk-model-color').checked;
      const hex = document.getElementById('col-model').value;
      activeModel.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => {
            if (!m.color) return;
            if (!m.userData.origColor) m.userData.origColor = m.color.clone();
            if (enabled) m.color.set(hex);
            else m.color.copy(m.userData.origColor);
            m.needsUpdate = true;
          });
        }
      });
    }

    function syncPostFxUniforms() {
      postFxEnabled = document.getElementById('chk-postfx').checked;
      renderer.toneMapping = mapToneMapping(document.getElementById('sel-tonemap').value);
      const bloomOn = document.getElementById('chk-bloom').checked;
      bloomPass.enabled = postFxEnabled && bloomOn;
      bloomPass.strength = parseFloat(document.getElementById('rng-bloom-str').value);
      bloomPass.threshold = parseFloat(document.getElementById('rng-bloom-thresh').value);
      bloomPass.radius = parseFloat(document.getElementById('rng-bloom-rad').value);

      gradingPass.enabled = postFxEnabled;
      const u = gradingPass.uniforms;
      u.uBrightness.value = parseFloat(document.getElementById('rng-brightness').value);
      u.uContrast.value = parseFloat(document.getElementById('rng-contrast').value);
      u.uSharpness.value = parseFloat(document.getElementById('rng-sharpness').value);
      u.uChromaticAberration.value = parseFloat(document.getElementById('rng-chroma').value);
      u.uVignetteIntensity.value = parseFloat(document.getElementById('rng-vig-int').value);
      u.uVignetteOffset.value = parseFloat(document.getElementById('rng-vig-off').value);
      u.uSaturation.value = parseFloat(document.getElementById('rng-sat').value);
      u.uTemperature.value = parseFloat(document.getElementById('rng-temp').value);
      u.uTint.value = parseFloat(document.getElementById('rng-tint').value);
      u.uColorBalance.value.set(
        parseFloat(document.getElementById('rng-bal-r').value),
        parseFloat(document.getElementById('rng-bal-g').value),
        parseFloat(document.getElementById('rng-bal-b').value)
      );
    }

    function applyPostPreset(preset) {
      const presets = {
        reset: { enabled: true, tm: 'aces', br: 0, ct: 0, sh: 0, bl: false, bs: 0.35, bt: 0.82, brad: 0.35, ca: 0, vi: 0, vo: 1.0, sat: 1, tmp: 0, tnt: 0, r: 1, g: 1, b: 1 },
        studio: { enabled: true, tm: 'aces', br: 0.02, ct: 0.06, sh: 0.28, bl: true, bs: 0.22, bt: 0.85, brad: 0.3, ca: 0, vi: 0.22, vo: 1.05, sat: 1.04, tmp: 0, tnt: 0, r: 1, g: 1, b: 1 },
        cinematic: { enabled: true, tm: 'agx', br: -0.02, ct: 0.18, sh: 0.35, bl: true, bs: 0.48, bt: 0.72, brad: 0.45, ca: 0.0025, vi: 0.48, vo: 0.92, sat: 1.08, tmp: 0.14, tnt: -0.04, r: 1.04, g: 0.99, b: 0.96 },
        crisp: { enabled: true, tm: 'neutral', br: 0.01, ct: 0.14, sh: 0.85, bl: false, bs: 0.18, bt: 0.88, brad: 0.2, ca: 0, vi: 0.15, vo: 1.1, sat: 1.05, tmp: -0.05, tnt: 0, r: 1, g: 1, b: 1.02 },
        glow: { enabled: true, tm: 'aces', br: 0.03, ct: 0.12, sh: 0.2, bl: true, bs: 0.95, bt: 0.55, brad: 0.65, ca: 0.0018, vi: 0.32, vo: 0.96, sat: 1.12, tmp: 0.06, tnt: 0.03, r: 1, g: 1, b: 1 }
      };
      const p = presets[preset] || presets.reset;
      document.getElementById('chk-postfx').checked = p.enabled;
      document.getElementById('sel-tonemap').value = p.tm;
      document.getElementById('rng-brightness').value = p.br;
      document.getElementById('rng-contrast').value = p.ct;
      document.getElementById('rng-sharpness').value = p.sh;
      document.getElementById('chk-bloom').checked = p.bl;
      document.getElementById('rng-bloom-str').value = p.bs;
      document.getElementById('rng-bloom-thresh').value = p.bt;
      document.getElementById('rng-bloom-rad').value = p.brad;
      document.getElementById('rng-chroma').value = p.ca;
      document.getElementById('rng-vig-int').value = p.vi;
      document.getElementById('rng-vig-off').value = p.vo;
      document.getElementById('rng-sat').value = p.sat;
      document.getElementById('rng-temp').value = p.tmp;
      document.getElementById('rng-tint').value = p.tnt;
      document.getElementById('rng-bal-r').value = p.r;
      document.getElementById('rng-bal-g').value = p.g;
      document.getElementById('rng-bal-b').value = p.b;
      syncPostFxUniforms();
    }

    function activateAnimationClip(clipChoice) {
      if (!mixer || clips.length === 0) return;
      mixer.stopAllAction();
      const loopMode = document.getElementById('sel-anim-loop').value;
      const loopStyle = mapLoopStyle(loopMode);
      const targets = clipChoice === '__ALL__'
        ? clips
        : [clips.find(c => c.name === clipChoice) || clips[0]];
      let maxDur = 0;
      activeActions = targets.map(c => {
        const act = mixer.clipAction(c);
        act.reset();
        act.loop = loopStyle;
        act.clampWhenFinished = loopMode === 'once';
        act.play();
        maxDur = Math.max(maxDur, c.duration || 0);
        return act;
      });
      activeDuration = maxDur || 1;
      document.getElementById('rng-anim-time').max = String(activeDuration);
    }

    function fitModel(root, modelAnimations = []) {
      if (activeModel) scene.remove(activeModel);
      if (skeletonHelper) {
        scene.remove(skeletonHelper);
        skeletonHelper.dispose();
        skeletonHelper = null;
      }
      if (mixer) {
        mixer.stopAllAction();
        mixer = null;
        activeActions = [];
      }

      activeModel = root;
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.001);
      root.scale.multiplyScalar(2.0 / maxDim);

      const scaledBox = new THREE.Box3().setFromObject(root);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      root.position.x -= scaledCenter.x;
      root.position.z -= scaledCenter.z;
      root.position.y -= scaledBox.min.y;

      let hasBones = false;
      root.traverse((obj) => {
        if (obj.isBone || obj.isSkinnedMesh) hasBones = true;
        if (obj.isSkinnedMesh) obj.frustumCulled = false;
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          if (obj.geometry && !obj.geometry.attributes.normal) {
            obj.geometry.computeVertexNormals();
          }
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => {
            if (m && m.map) {
              if (m.color && m.color.r === 0 && m.color.g === 0 && m.color.b === 0) {
                m.color.setHex(0xffffff);
              }
              m.map.colorSpace = THREE.SRGBColorSpace;
              m.map.needsUpdate = true;
            }
          });
        }
      });

      if (hasBones) {
        skeletonHelper = new THREE.SkeletonHelper(root);
        skeletonHelper.visible = document.getElementById('chk-skeleton').checked;
        scene.add(skeletonHelper);
      }

      const finalBox = new THREE.Box3().setFromObject(root);
      const finalSize = finalBox.getSize(new THREE.Vector3());
      const footprint = Math.max(finalSize.x, finalSize.z, 0.8) * 1.65;
      contactPlane.scale.set(footprint / 3.2, footprint / 3.2, 1);
      const gScale = Math.max(footprint, 3.0) * 2.2;
      gridPlane.scale.set(gScale / 10, gScale / 10, 1);

      controls.target.set(0, finalSize.y * 0.45, 0);
      camera.position.set(2.2, finalSize.y * 0.95 + 0.6, 2.6);
      controls.update();

      scene.add(root);

      clips = modelAnimations || [];
      const selClip = document.getElementById('sel-anim-clip');
      selClip.innerHTML = '';
      if (clips.length > 0) {
        mixer = new THREE.AnimationMixer(root);
        clips.forEach((c, idx) => {
          c.name = c.name || ('Clip_' + (idx + 1));
        });
        if (clips.length > 1) {
          const optAll = document.createElement('option');
          optAll.value = '__ALL__';
          optAll.textContent = 'All Clips (Simultaneous)';
          selClip.appendChild(optAll);
        }
        clips.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = c.name;
          selClip.appendChild(opt);
        });
        const initialChoice = '${animationState.activeClip || ''}' || clips[0].name;
        selClip.value = initialChoice;
        if (!selClip.value) selClip.value = clips[0].name;
        activateAnimationClip(selClip.value);
        document.getElementById('btn-tab-anim').textContent = 'Animation (' + clips.length + ')';
      } else {
        const optNone = document.createElement('option');
        optNone.value = '';
        optNone.textContent = 'No animations';
        selClip.appendChild(optNone);
        document.getElementById('btn-tab-anim').textContent = 'Animation & Rig';
      }

      applyHdriOpacityAndLight();
      applyModelColorOverride();
      dropzoneWrap.classList.add('hidden');
      dockWrapper.classList.add('visible');
    }

    function resize() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || (window.innerHeight - 80);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
      gradingPass.uniforms.uResolution.value.set(w * dpr, h * dpr);
    }
    window.addEventListener('resize', resize);
    resize();

    function animate() {
      requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (mixer && activeActions.length > 0 && animPlaying) {
        mixer.update(dt * animSpeed);
        const cur = activeActions[0].time || 0;
        document.getElementById('rng-anim-time').value = String(cur);
        document.getElementById('lbl-anim-time').textContent =
          cur.toFixed(1) + 's / ' + activeDuration.toFixed(1) + 's';
      }
      controls.update();
      if (postFxEnabled) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }
    animate();

    const embeddedBase64 = "${embeddedBase64}";
    if (embeddedBase64) {
      const binStr = atob(embeddedBase64);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      new GLTFLoader().parse(bytes.buffer, '', (gltf) => fitModel(gltf.scene, gltf.animations || []));
    }

    function createFallbackTexBlobUrl() {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#d4d8e0';
      ctx.fillRect(0, 0, 64, 64);
      const dataUrl = c.toDataURL('image/png');
      const bin = atob(dataUrl.split(',')[1]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([arr], { type: 'image/png' }));
    }
    const fallbackTexBlobUrl = createFallbackTexBlobUrl();

    function applyDroppedTexture(file) {
      if (!activeModel) return;
      const url = URL.createObjectURL(file);
      new THREE.TextureLoader().load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        tex.needsUpdate = true;
        activeModel.traverse((o) => {
          if (o.isMesh && o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => {
              m.map = tex;
              if (m.color) m.color.setHex(0xffffff);
              m.needsUpdate = true;
            });
          }
        });
      });
    }

    async function handleFiles(files) {
      const list = Array.from(files);
      const hdr = list.find(f => /\\.(hdr|exr)$/i.test(f.name));
      if (hdr) {
        const url = URL.createObjectURL(hdr);
        const loader = hdr.name.toLowerCase().endsWith('.exr') ? new EXRLoader() : new RGBELoader();
        loader.load(url, (tex) => {
          activeEnvTex = pmremGenerator.fromEquirectangular(tex).texture;
          applyHdriOpacityAndLight();
          tex.dispose();
          URL.revokeObjectURL(url);
        });
      }

      const modelFile = list.find(f => /\\.(glb|gltf|usdz|usda|fbx|obj|stl|ply|dae|3mf)$/i.test(f.name));
      if (modelFile) {
        const resMap = new Map();
        list.forEach(f => {
          const u = URL.createObjectURL(f);
          resMap.set(f.name.toLowerCase(), u);
          if (f.webkitRelativePath) resMap.set(f.webkitRelativePath.toLowerCase(), u);
        });
        const lower = modelFile.name.toLowerCase();
        let rootUrl = resMap.get(lower);

        if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
          if (lower.endsWith('.gltf')) {
            try {
              const txt = await modelFile.text();
              const json = JSON.parse(txt);
              const resolveUri = (uri) => {
                const clean = decodeURIComponent(uri).replace(/^(\\.\\/|\\/)+/, '').toLowerCase();
                const base = clean.split('/').pop() || clean;
                return resMap.get(clean) || resMap.get(base) || fallbackTexBlobUrl;
              };
              if (Array.isArray(json.buffers)) json.buffers.forEach(b => { if (b.uri && !b.uri.startsWith('data:')) b.uri = resolveUri(b.uri); });
              if (Array.isArray(json.images)) json.images.forEach(img => { if (img.uri && !img.uri.startsWith('data:')) img.uri = resolveUri(img.uri); });
              rootUrl = URL.createObjectURL(new Blob([JSON.stringify(json)], { type: 'model/gltf+json' }));
            } catch (e) {}
          }
          new GLTFLoader().load(rootUrl, (gltf) => fitModel(gltf.scene, gltf.animations || []));
        } else if (lower.endsWith('.usdz') || lower.endsWith('.usda')) {
          new USDZLoader().load(rootUrl, (grp) => fitModel(grp, grp.animations || []));
        } else if (lower.endsWith('.fbx')) {
          new FBXLoader().load(rootUrl, (grp) => fitModel(grp, grp.animations || []));
        } else if (lower.endsWith('.obj')) {
          const mtlFile = list.find(f => /\\.mtl$/i.test(f.name));
          const objLoader = new OBJLoader();
          if (mtlFile) {
            const mtlUrl = resMap.get(mtlFile.name.toLowerCase());
            const mtl = await new MTLLoader().loadAsync(mtlUrl);
            mtl.preload();
            objLoader.setMaterials(mtl);
          }
          objLoader.load(rootUrl, (grp) => fitModel(grp, []));
        } else if (lower.endsWith('.stl')) {
          new STLLoader().load(rootUrl, (geo) => {
            geo.computeVertexNormals();
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd4d8e0, roughness: 0.35, metalness: 0.2 }));
            const grp = new THREE.Group(); grp.add(mesh);
            fitModel(grp, []);
          });
        } else if (lower.endsWith('.ply')) {
          new PLYLoader().load(rootUrl, (geo) => {
            geo.computeVertexNormals();
            const hasCol = Boolean(geo.attributes.color);
            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: hasCol ? 0xffffff : 0xd4d8e0, roughness: 0.35, metalness: 0.15, vertexColors: hasCol }));
            const grp = new THREE.Group(); grp.add(mesh);
            fitModel(grp, []);
          });
        } else if (lower.endsWith('.dae')) {
          new ColladaLoader().load(rootUrl, (dae) => fitModel(dae.scene, dae.scene.animations || []));
        } else if (lower.endsWith('.3mf')) {
          new ThreeMFLoader().load(rootUrl, (grp) => fitModel(grp, []));
        }
      } else {
        const texFile = list.find(f => /\\.(png|jpe?g|webp)$/i.test(f.name));
        if (texFile) applyDroppedTexture(texFile);
      }
    }

    // Tab switching inside exported HTML dock
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
      };
    });

    // Preset buttons
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.onclick = () => applyPostPreset(btn.getAttribute('data-preset'));
    });

    function toggleMinimizeDock() {
      const isMin = dock.classList.toggle('minimized');
      btnMinimizeDock.textContent = isMin ? '▴ Show Controls' : '▾ Minimize Controls';
    }
    btnMinimizeDock.onclick = toggleMinimizeDock;
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'h') toggleMinimizeDock();
    });

    document.getElementById('drop-card').onclick = () => document.getElementById('file-input').click();
    document.getElementById('btn-choose-file').onclick = () => document.getElementById('file-input').click();
    document.getElementById('btn-open-model').onclick = () => document.getElementById('file-input').click();
    document.getElementById('btn-open-tex').onclick = () => document.getElementById('tex-input').click();
    document.getElementById('btn-open-hdr').onclick = () => document.getElementById('hdr-input').click();
    document.getElementById('file-input').onchange = (e) => handleFiles(e.target.files);
    document.getElementById('tex-input').onchange = (e) => { if (e.target.files[0]) applyDroppedTexture(e.target.files[0]); };
    document.getElementById('hdr-input').onchange = (e) => handleFiles(e.target.files);

    window.addEventListener('dragover', (e) => { e.preventDefault(); document.getElementById('drop-card').classList.add('dragover'); });
    window.addEventListener('dragleave', () => document.getElementById('drop-card').classList.remove('dragover'));
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      document.getElementById('drop-card').classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });

    // Animation UI listeners
    document.getElementById('btn-anim-play').onclick = (e) => {
      animPlaying = !animPlaying;
      e.target.textContent = animPlaying ? 'Pause' : 'Play';
      e.target.classList.toggle('active', animPlaying);
    };
    document.getElementById('btn-anim-rewind').onclick = () => {
      if (!mixer) return;
      activeActions.forEach(a => { a.time = 0; });
      mixer.update(0);
      document.getElementById('rng-anim-time').value = '0';
      document.getElementById('lbl-anim-time').textContent = '0.0s / ' + activeDuration.toFixed(1) + 's';
    };
    document.getElementById('sel-anim-clip').onchange = (e) => {
      activateAnimationClip(e.target.value);
    };
    document.getElementById('rng-anim-time').oninput = (e) => {
      if (!mixer) return;
      const t = parseFloat(e.target.value);
      activeActions.forEach(a => {
        const dur = a.getClip().duration || 1;
        a.time = Math.min(t, dur);
      });
      mixer.update(0);
      document.getElementById('lbl-anim-time').textContent = t.toFixed(1) + 's / ' + activeDuration.toFixed(1) + 's';
    };
    document.getElementById('rng-anim-speed').oninput = (e) => {
      animSpeed = parseFloat(e.target.value);
    };
    document.getElementById('sel-anim-loop').onchange = () => {
      activateAnimationClip(document.getElementById('sel-anim-clip').value);
    };
    document.getElementById('chk-skeleton').onchange = (e) => {
      if (skeletonHelper) skeletonHelper.visible = e.target.checked;
    };

    function refreshGrid() {
      const mode = document.getElementById('sel-grid-mode').value;
      const fc = document.getElementById('col-floor').value;
      const gc = document.getElementById('col-grid').value;
      gridPlane.visible = mode !== 'none';
      gridMat.map.dispose();
      gridMat.map = makeGridTex(mode, fc, gc);
      gridMat.needsUpdate = true;
    }

    document.getElementById('chk-shadow').onchange = (e) => { contactPlane.visible = e.target.checked; };
    document.getElementById('rng-shadow-opacity').oninput = (e) => { contactMat.opacity = parseFloat(e.target.value); };
    document.getElementById('rng-shadow-blur').oninput = (e) => {
      contactMat.map.dispose();
      contactMat.map = makeShadowTex(parseFloat(e.target.value));
      contactMat.needsUpdate = true;
    };
    document.getElementById('sel-grid-mode').onchange = refreshGrid;
    document.getElementById('col-floor').oninput = refreshGrid;
    document.getElementById('col-grid').oninput = refreshGrid;

    document.getElementById('chk-hdri-light').onchange = applyHdriOpacityAndLight;
    document.getElementById('rng-hdri-opacity').oninput = applyHdriOpacityAndLight;
    document.getElementById('rng-exposure').oninput = (e) => { renderer.toneMappingExposure = parseFloat(e.target.value); };

    document.getElementById('col-bg').oninput = (e) => {
      scene.background = new THREE.Color(e.target.value);
      document.body.style.background = e.target.value;
    };
    document.getElementById('chk-model-color').onchange = applyModelColorOverride;
    document.getElementById('col-model').oninput = () => {
      document.getElementById('chk-model-color').checked = true;
      applyModelColorOverride();
    };

    document.getElementById('chk-autorotate').onchange = (e) => { controls.autoRotate = e.target.checked; };
    document.getElementById('chk-wireframe').onchange = (e) => {
      if (!activeModel) return;
      activeModel.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => { m.wireframe = e.target.checked; });
        }
      });
    };
    document.getElementById('btn-reset-cam').onclick = () => {
      if (activeModel) fitModel(activeModel, clips);
    };

    // Post-FX listeners
    [
      'chk-postfx', 'sel-tonemap', 'rng-brightness', 'rng-contrast', 'rng-sharpness',
      'chk-bloom', 'rng-bloom-str', 'rng-bloom-thresh', 'rng-bloom-rad',
      'rng-chroma', 'rng-vig-int', 'rng-vig-off', 'rng-sat', 'rng-temp', 'rng-tint',
      'rng-bal-r', 'rng-bal-g', 'rng-bal-b'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', syncPostFxUniforms);
        el.addEventListener('change', syncPostFxUniforms);
      }
    });
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeModelName
    ? `kmod-viewer-${safeModelName.replace(/\.(glb|gltf|usdz|usda|fbx|obj|stl|ply|dae|3mf)$/i, '')}.html`
    : 'kmod-viewer-offline.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
