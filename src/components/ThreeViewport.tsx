import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import {
  AnimationState,
  CameraConfig,
  CameraPreset,
  EnvironmentConfig,
  InspectionMode,
  LoadedGltfAsset,
  MaterialColorConfig,
  ModelMetadata,
  PostProcessingConfig,
  ShadowConfig,
} from '../types/viewer';
import {
  createGroundGridTexture,
  createProceduralEnvTexture,
  createRadialShadowTexture,
} from '../utils/shadowTexture';
import { resolveGltfResourceUrl } from '../utils/fileIngest';
import {
  KModGradingShader,
  mapToneMappingConstant,
} from '../utils/postProcessingShader';

// Module-scope reusable math helpers (Zero GC in render loop)
const _box3 = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();

const isSoftwareGl = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

interface ThreeViewportProps {
  gltfAsset: LoadedGltfAsset | null;
  customEnvironmentFile: File | null;
  customTextureFiles: File[] | null;
  shadowConfig: ShadowConfig;
  envConfig: EnvironmentConfig;
  cameraConfig: CameraConfig;
  materialColorConfig: MaterialColorConfig;
  postProcessingConfig: PostProcessingConfig;
  inspectionMode: InspectionMode;
  cameraPresetTrigger: { preset: CameraPreset; timestamp: number } | null;
  animationState: AnimationState;
  onModelLoaded: (metadata: ModelMetadata) => void;
  onPackedGlbReady: (buffer: ArrayBuffer) => void;
  onLoadError: (message: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

interface InternalSceneRefs {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  gradingPass: ShaderPass;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  pmremGenerator: THREE.PMREMGenerator;
  keyLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
  groundGridPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  contactShadowPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  shadowReceiverPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  skyboxBackdropSphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  modelRoot: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  clips: THREE.AnimationClip[];
  activeAction: THREE.AnimationAction | null;
  studioEnvTex: THREE.Texture | null;
  neutralEnvTex: THREE.Texture | null;
  warmEnvTex: THREE.Texture | null;
  customEnvTex: THREE.Texture | null;
  customBgTex: THREE.Texture | null;
  normalMaterial: THREE.MeshNormalMaterial;
  defaultCamPos: THREE.Vector3;
  defaultCamTarget: THREE.Vector3;
  modelMaxDim: number;
  cameraTransitionActive: boolean;
  requestRender: () => void;
  ensureLoopState: () => void;
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  gltfAsset,
  customEnvironmentFile,
  customTextureFiles,
  shadowConfig,
  envConfig,
  cameraConfig,
  materialColorConfig,
  postProcessingConfig,
  inspectionMode,
  cameraPresetTrigger,
  animationState,
  onModelLoaded,
  onPackedGlbReady,
  onLoadError,
  onLoadingChange,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRefs = useRef<InternalSceneRefs | null>(null);

  const animStateRef = useRef<AnimationState>(animationState);
  animStateRef.current = animationState;

  const envConfigRef = useRef<EnvironmentConfig>(envConfig);
  envConfigRef.current = envConfig;

  const cameraConfigRef = useRef<CameraConfig>(cameraConfig);
  cameraConfigRef.current = cameraConfig;

  const shadowConfigRef = useRef<ShadowConfig>(shadowConfig);
  shadowConfigRef.current = shadowConfig;

  const postProcRef = useRef<PostProcessingConfig>(postProcessingConfig);
  postProcRef.current = postProcessingConfig;

  // Initialize Three.js WebGLRenderer, Scene & EffectComposer once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = mapToneMappingConstant(postProcRef.current.toneMapping);
    renderer.toneMappingExposure = envConfigRef.current.exposure;
    const pixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(envConfigRef.current.backgroundColor);
    scene.background = bgColor;
    scene.fog = new THREE.FogExp2(bgColor.getHex(), 0.02);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 500);
    camera.position.set(2.4, 1.7, 3.0);

    // Post-Processing EffectComposer setup
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      postProcRef.current.bloomStrength,
      postProcRef.current.bloomRadius,
      postProcRef.current.bloomThreshold
    );
    bloomPass.enabled =
      postProcRef.current.bloomEnabled && postProcRef.current.bloomStrength > 0.001;
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    const gradingPass = new ShaderPass(KModGradingShader);
    gradingPass.uniforms.resolution.value.set(
      1 / Math.max(1, width * pixelRatio),
      1 / Math.max(1, height * pixelRatio)
    );
    composer.addPass(gradingPass);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.85;
    controls.minDistance = 0.15;
    controls.maxDistance = 80;
    controls.autoRotate = cameraConfigRef.current.autoRotate && !isSoftwareGl;
    controls.autoRotateSpeed = cameraConfigRef.current.autoRotateSpeed;
    controls.target.set(0, 0.6, 0);
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const studioEnvTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envConfigRef.current.useHdriLight ? studioEnvTex : null;

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 3-Point Studio Rig (Warm Key, Cool Hemisphere Fill, Rim Light)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.72);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.85);
    keyLight.position.set(4.5, 7.5, 5.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    const d = 3.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.8);
    rimLight.position.set(-4.0, 4.5, -4.5);
    scene.add(rimLight);

    // 1. Ground Grid & Floor Texture Plane (y = -0.002)
    const gridTex = createGroundGridTexture(
      shadowConfigRef.current.gridMode,
      shadowConfigRef.current.floorColor,
      shadowConfigRef.current.gridColor,
      maxAnisotropy
    );
    const groundGridMat = new THREE.MeshBasicMaterial({
      map: gridTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.95,
    });
    const groundGridPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      groundGridMat
    );
    groundGridPlane.rotation.x = -Math.PI / 2;
    groundGridPlane.position.y = -0.002;
    groundGridPlane.renderOrder = 0;
    groundGridPlane.visible = false;
    scene.add(groundGridPlane);

    // 2. Directional Shadow Receiver Plane (y = 0.0)
    const shadowReceiverMat = new THREE.ShadowMaterial({
      opacity: shadowConfigRef.current.opacity * 0.45,
      transparent: true,
      depthWrite: false,
    });
    const shadowReceiverPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      shadowReceiverMat
    );
    shadowReceiverPlane.rotation.x = -Math.PI / 2;
    shadowReceiverPlane.position.y = 0.0;
    shadowReceiverPlane.receiveShadow = true;
    shadowReceiverPlane.renderOrder = 1;
    shadowReceiverPlane.visible = false;
    scene.add(shadowReceiverPlane);

    // 3. Soft Radial Contact Shadow Plane (y = 0.003 with polygonOffset)
    const contactShadowTex = createRadialShadowTexture(
      shadowConfigRef.current.blur,
      maxAnisotropy
    );
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: shadowConfigRef.current.opacity,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const contactShadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 3.2),
      contactShadowMat
    );
    contactShadowPlane.rotation.x = -Math.PI / 2;
    contactShadowPlane.position.y = 0.003;
    contactShadowPlane.renderOrder = 2;
    contactShadowPlane.visible = false;
    scene.add(contactShadowPlane);

    const skyboxGeo = new THREE.SphereGeometry(180, 48, 24);
    const skyboxMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      opacity: envConfigRef.current.hdriOpacity,
    });
    const skyboxBackdropSphere = new THREE.Mesh(skyboxGeo, skyboxMat);
    skyboxBackdropSphere.visible = false;
    scene.add(skyboxBackdropSphere);

    const normalMaterial = new THREE.MeshNormalMaterial();

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let continuousLoopRunning = false;
    const clock = new THREE.Clock();

    function drawFrame() {
      if (!isSoftwareGl && postProcRef.current.enabled) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepScene(dt: number): boolean {
      const refs = sceneRefs.current;
      if (!refs) return false;

      let needsMoreFrames = false;

      if (refs.mixer && refs.activeAction && animStateRef.current.isPlaying) {
        refs.mixer.update(dt * animStateRef.current.speed);
        needsMoreFrames = true;
      }

      if (refs.cameraTransitionActive) {
        const lambda = 7.5;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, lambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, lambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, lambda, dt);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, lambda, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, lambda, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, lambda, dt);

        const posDistSq = camera.position.distanceToSquared(_camGoalPos);
        const targetDistSq = controls.target.distanceToSquared(_camGoalTarget);
        if (posDistSq < 0.0002 && targetDistSq < 0.0002) {
          camera.position.copy(_camGoalPos);
          controls.target.copy(_camGoalTarget);
          refs.cameraTransitionActive = false;
        } else {
          needsMoreFrames = true;
        }
      }

      if (controls.autoRotate) {
        needsMoreFrames = true;
      }

      controls.update();
      return needsMoreFrames;
    }

    function tick() {
      const refs = sceneRefs.current;
      if (!refs) return;

      const dt = Math.min(clock.getDelta(), 0.1);
      const keepLooping = stepScene(dt);
      drawFrame();

      if (!keepLooping) {
        continuousLoopRunning = false;
        return;
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    function requestRender() {
      if (continuousLoopRunning) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const dt = Math.min(clock.getDelta(), 0.1);
        const keepGoing = stepScene(dt);
        drawFrame();
        const done = () => {
          renderBusy = false;
          if (renderDirty || keepGoing) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    function ensureLoopState() {
      const refs = sceneRefs.current;
      if (!refs) return;
      const shouldLoop =
        Boolean(refs.mixer && refs.activeAction && animStateRef.current.isPlaying) ||
        refs.cameraTransitionActive ||
        Boolean(refs.controls.autoRotate && refs.modelRoot);

      if (shouldLoop && !continuousLoopRunning) {
        continuousLoopRunning = true;
        clock.getDelta();
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
      } else if (!shouldLoop) {
        requestRender();
      }
    }

    const onControlsStart = () => {
      if (sceneRefs.current) {
        sceneRefs.current.cameraTransitionActive = false;
      }
    };
    const onControlsChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', onControlsChange);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w === 0 || h === 0) return;
      const pr = renderer.getPixelRatio();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
      gradingPass.uniforms.resolution.value.set(
        1 / Math.max(1, w * pr),
        1 / Math.max(1, h * pr)
      );
      requestRender();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };
    const onContextRestored = () => {
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    sceneRefs.current = {
      renderer,
      composer,
      bloomPass,
      gradingPass,
      scene,
      camera,
      controls,
      pmremGenerator,
      keyLight,
      hemiLight,
      rimLight,
      groundGridPlane,
      contactShadowPlane,
      shadowReceiverPlane,
      skyboxBackdropSphere,
      modelRoot: null,
      mixer: null,
      clips: [],
      activeAction: null,
      studioEnvTex,
      neutralEnvTex: null,
      warmEnvTex: null,
      customEnvTex: null,
      customBgTex: null,
      normalMaterial,
      defaultCamPos: new THREE.Vector3(2.4, 1.7, 3.0),
      defaultCamTarget: new THREE.Vector3(0, 0.6, 0),
      modelMaxDim: 2.0,
      cameraTransitionActive: false,
      requestRender,
      ensureLoopState,
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', onControlsChange);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      normalMaterial.dispose();
      groundGridPlane.geometry.dispose();
      groundGridPlane.material.map?.dispose();
      groundGridPlane.material.dispose();
      contactShadowPlane.geometry.dispose();
      contactShadowPlane.material.map?.dispose();
      contactShadowPlane.material.dispose();
      shadowReceiverPlane.geometry.dispose();
      shadowReceiverPlane.material.dispose();
      skyboxBackdropSphere.geometry.dispose();
      skyboxBackdropSphere.material.dispose();
      studioEnvTex.dispose();
      pmremGenerator.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
  }, []);

  // Load glTF / GLB model whenever gltfAsset changes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !gltfAsset) return;

    onLoadingChange(true);
    const runtimeMissing = new Set<string>(gltfAsset.missingTextures || []);

    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) =>
      resolveGltfResourceUrl(url, gltfAsset.rootFileUrl, gltfAsset.resourceMap, (missing) => {
        runtimeMissing.add(missing);
      })
    );

    const loader = new GLTFLoader(manager);
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      gltfAsset.rootFileUrl,
      (gltf) => {
        dracoLoader.dispose();

        if (refs.modelRoot) {
          refs.scene.remove(refs.modelRoot);
          refs.modelRoot.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.geometry?.dispose();
            }
          });
          refs.modelRoot = null;
        }
        if (refs.mixer) {
          refs.mixer.stopAllAction();
          refs.mixer = null;
          refs.activeAction = null;
        }

        const root = gltf.scene || gltf.scenes[0];
        if (!root) {
          onLoadingChange(false);
          onLoadError('The uploaded glTF file does not contain a valid 3D scene.');
          return;
        }

        root.updateMatrixWorld(true);
        _box3.setFromObject(root);
        _box3.getSize(_size);
        _box3.getCenter(_center);

        const rawDimensions = {
          x: Number(_size.x.toFixed(2)),
          y: Number(_size.y.toFixed(2)),
          z: Number(_size.z.toFixed(2)),
        };

        const maxDim = Math.max(_size.x, _size.y, _size.z, 0.001);
        const targetSize = 2.0;
        const normScale = targetSize / maxDim;
        root.scale.multiplyScalar(normScale);

        root.updateMatrixWorld(true);
        _box3.setFromObject(root);
        _box3.getSize(_size);
        _box3.getCenter(_center);

        root.position.x -= _center.x;
        root.position.z -= _center.z;
        root.position.y -= _box3.min.y;

        let meshCount = 0;
        let vertexCount = 0;
        let triangleCount = 0;
        const materialSet = new Set<THREE.Material>();
        const textureSet = new Set<THREE.Texture>();
        const maxAniso = refs.renderer.capabilities.getMaxAnisotropy();

        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            meshCount++;
            mesh.castShadow = !isSoftwareGl;
            mesh.receiveShadow = !isSoftwareGl;

            const geo = mesh.geometry;
            if (geo) {
              const posAttr = geo.attributes.position;
              if (posAttr) {
                vertexCount += posAttr.count;
                if (geo.index) {
                  triangleCount += Math.floor(geo.index.count / 3);
                } else {
                  triangleCount += Math.floor(posAttr.count / 3);
                }
              }
            }

            mesh.userData.originalMaterial = mesh.material;

            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat) => {
              if (!mat) return;
              materialSet.add(mat);
              const stdMat = mat as THREE.MeshStandardMaterial;

              if (stdMat.color) {
                if (
                  stdMat.map &&
                  stdMat.color.r === 0 &&
                  stdMat.color.g === 0 &&
                  stdMat.color.b === 0
                ) {
                  stdMat.color.setHex(0xffffff);
                }
                stdMat.userData.originalColor = stdMat.color.clone();
              }
              stdMat.userData.originalMap = stdMat.map || null;

              if (stdMat.map) {
                stdMat.map.colorSpace = THREE.SRGBColorSpace;
                stdMat.map.anisotropy = maxAniso;
                stdMat.map.needsUpdate = true;
                textureSet.add(stdMat.map);
              }
              if (stdMat.emissiveMap) {
                stdMat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
                stdMat.emissiveMap.anisotropy = maxAniso;
                textureSet.add(stdMat.emissiveMap);
              }
              if (stdMat.normalMap) {
                stdMat.normalMap.anisotropy = maxAniso;
                textureSet.add(stdMat.normalMap);
              }
              if (stdMat.roughnessMap) {
                stdMat.roughnessMap.anisotropy = maxAniso;
                textureSet.add(stdMat.roughnessMap);
              }
              if (stdMat.metalnessMap) {
                stdMat.metalnessMap.anisotropy = maxAniso;
                textureSet.add(stdMat.metalnessMap);
              }

              stdMat.envMapIntensity = envConfigRef.current.useHdriLight
                ? envConfigRef.current.hdriOpacity
                : 0;
              stdMat.needsUpdate = true;
            });
          }
        });

        const modelContainer = new THREE.Group();
        modelContainer.add(root);
        refs.scene.add(modelContainer);
        refs.modelRoot = modelContainer;
        refs.modelMaxDim = Math.max(_size.x, _size.y, _size.z, 1.0);

        const footprintX = Math.max(_size.x * 1.65, 0.9);
        const footprintZ = Math.max(_size.z * 1.65, 0.9);
        refs.contactShadowPlane.scale.set(footprintX / 3.2, footprintZ / 3.2, 1);
        refs.contactShadowPlane.visible = shadowConfigRef.current.enabled;
        refs.shadowReceiverPlane.visible =
          shadowConfigRef.current.enabled && shadowConfigRef.current.directionalShadow;

        const gridScale = Math.max(footprintX, footprintZ, 3.0) * 2.2;
        refs.groundGridPlane.scale.set(gridScale / 10, gridScale / 10, 1);
        refs.groundGridPlane.visible = shadowConfigRef.current.gridMode !== 'none';

        const targetY = Math.max(_size.y * 0.45, 0.25);
        const dist = Math.max(_size.x, _size.y, _size.z, 1.2) * 1.45;
        refs.defaultCamTarget.set(0, targetY, 0);
        refs.defaultCamPos.set(dist * 0.82, targetY + dist * 0.48, dist * 1.05);

        refs.controls.target.copy(refs.defaultCamTarget);
        refs.camera.position.copy(refs.defaultCamPos);
        refs.controls.update();

        const clipNames: string[] = [];
        refs.clips = gltf.animations || [];
        if (refs.clips.length > 0) {
          const mixer = new THREE.AnimationMixer(root);
          refs.mixer = mixer;
          refs.clips.forEach((clip, idx) => {
            const name = clip.name || `Animation_${idx + 1}`;
            clip.name = name;
            clipNames.push(name);
          });
          const firstAction = mixer.clipAction(refs.clips[0]);
          firstAction.play();
          refs.activeAction = firstAction;
        }

        if (!isSoftwareGl) {
          refs.renderer.compile(refs.scene, refs.camera);
        }

        onLoadingChange(false);
        onModelLoaded({
          fileName: gltfAsset.rootFileName,
          fileSize: gltfAsset.fileSize,
          meshCount,
          vertexCount,
          triangleCount,
          materialCount: materialSet.size,
          textureCount: textureSet.size,
          missingTextures: Array.from(runtimeMissing),
          animations: clipNames,
          dimensions: rawDimensions,
        });

        if (gltfAsset.rawGlbBuffer) {
          onPackedGlbReady(gltfAsset.rawGlbBuffer);
        } else {
          const exporter = new GLTFExporter();
          exporter.parse(
            root,
            (res) => {
              if (res instanceof ArrayBuffer && res.byteLength <= 18 * 1024 * 1024) {
                onPackedGlbReady(res);
              }
            },
            () => {},
            { binary: true }
          );
        }

        refs.ensureLoopState();
      },
      undefined,
      (err) => {
        dracoLoader.dispose();
        onLoadingChange(false);
        onLoadError(
          err instanceof Error
            ? `Failed to parse glTF model: ${err.message}`
            : 'Failed to parse glTF 2.0 model.'
        );
      }
    );
  }, [gltfAsset]);

  // Apply live-dropped or uploaded custom texture files onto the active model
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.modelRoot || !customTextureFiles || customTextureFiles.length === 0) {
      return;
    }

    const primaryFile = customTextureFiles[0];
    const blobUrl = URL.createObjectURL(primaryFile);
    const texLoader = new THREE.TextureLoader();
    const maxAniso = refs.renderer.capabilities.getMaxAnisotropy();

    texLoader.load(
      blobUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = maxAniso;
        texture.needsUpdate = true;

        refs.modelRoot?.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const orig = mesh.userData.originalMaterial || mesh.material;
          const list = Array.isArray(orig) ? orig : [orig];
          list.forEach((m: THREE.Material) => {
            const std = m as THREE.MeshStandardMaterial;
            if ('map' in std) {
              std.map = texture;
              if (std.color) {
                std.color.setHex(0xffffff);
              }
              std.needsUpdate = true;
            }
          });
        });

        refs.requestRender();

        if (refs.modelRoot?.children[0]) {
          new GLTFExporter().parse(
            refs.modelRoot.children[0],
            (res) => {
              if (res instanceof ArrayBuffer && res.byteLength <= 18 * 1024 * 1024) {
                onPackedGlbReady(res);
              }
            },
            () => {},
            { binary: true }
          );
        }
      },
      undefined,
      () => {
        URL.revokeObjectURL(blobUrl);
        onLoadError(`Could not load texture image ${primaryFile.name}`);
      }
    );
  }, [customTextureFiles]);

  // Handle custom .hdr or .exr file upload
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !customEnvironmentFile) return;

    onLoadingChange(true);
    const blobUrl = URL.createObjectURL(customEnvironmentFile);
    const isExr = customEnvironmentFile.name.toLowerCase().endsWith('.exr');
    const loader = isExr ? new EXRLoader() : new RGBELoader();

    loader.load(
      blobUrl,
      (texture) => {
        URL.revokeObjectURL(blobUrl);
        texture.mapping = THREE.EquirectangularReflectionMapping;

        const envMap = refs.pmremGenerator.fromEquirectangular(texture).texture;
        if (refs.customEnvTex) refs.customEnvTex.dispose();
        if (refs.customBgTex) refs.customBgTex.dispose();

        refs.customEnvTex = envMap;
        refs.customBgTex = texture;

        refs.scene.environment = envConfigRef.current.useHdriLight ? envMap : null;
        refs.skyboxBackdropSphere.material.map = texture;
        refs.skyboxBackdropSphere.material.needsUpdate = true;
        onLoadingChange(false);
        refs.requestRender();
      },
      undefined,
      () => {
        URL.revokeObjectURL(blobUrl);
        onLoadingChange(false);
        onLoadError(`Failed to load ${customEnvironmentFile.name}. Verify the .hdr or .exr file format.`);
      }
    );
  }, [customEnvironmentFile]);

  // Update Ground Shadow & Ground Grid Texture settings
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    const hasModel = Boolean(refs.modelRoot);
    refs.contactShadowPlane.visible = hasModel && shadowConfig.enabled;
    refs.shadowReceiverPlane.visible =
      hasModel && shadowConfig.enabled && shadowConfig.directionalShadow;
    refs.groundGridPlane.visible = hasModel && shadowConfig.gridMode !== 'none';

    refs.contactShadowPlane.material.opacity = shadowConfig.opacity;
    refs.shadowReceiverPlane.material.opacity = shadowConfig.opacity * 0.45;

    const maxAniso = refs.renderer.capabilities.getMaxAnisotropy();

    const newShadowTex = createRadialShadowTexture(shadowConfig.blur, maxAniso);
    refs.contactShadowPlane.material.map?.dispose();
    refs.contactShadowPlane.material.map = newShadowTex;
    refs.contactShadowPlane.material.needsUpdate = true;

    const newGridTex = createGroundGridTexture(
      shadowConfig.gridMode,
      shadowConfig.floorColor,
      shadowConfig.gridColor,
      maxAniso
    );
    refs.groundGridPlane.material.map?.dispose();
    refs.groundGridPlane.material.map = newGridTex;
    refs.groundGridPlane.material.needsUpdate = true;

    refs.keyLight.castShadow =
      !isSoftwareGl && shadowConfig.enabled && shadowConfig.directionalShadow;
    refs.requestRender();
  }, [shadowConfig]);

  // Update HDRI Light Toggle, HDRI Opacity, Exposure, and Background Color
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    refs.renderer.toneMappingExposure = envConfig.exposure;
    const maxAniso = refs.renderer.capabilities.getMaxAnisotropy();

    let activeEnv: THREE.Texture | null = refs.studioEnvTex;

    if (envConfig.preset === 'custom' && refs.customEnvTex) {
      activeEnv = refs.customEnvTex;
    } else if (envConfig.preset === 'neutral') {
      if (!refs.neutralEnvTex) {
        const raw = createProceduralEnvTexture('neutral', maxAniso);
        refs.neutralEnvTex = refs.pmremGenerator.fromEquirectangular(raw).texture;
        raw.dispose();
      }
      activeEnv = refs.neutralEnvTex;
    } else if (envConfig.preset === 'warm') {
      if (!refs.warmEnvTex) {
        const raw = createProceduralEnvTexture('warm', maxAniso);
        refs.warmEnvTex = refs.pmremGenerator.fromEquirectangular(raw).texture;
        raw.dispose();
      }
      activeEnv = refs.warmEnvTex;
    } else {
      activeEnv = refs.studioEnvTex;
    }

    refs.scene.environment = envConfig.useHdriLight ? activeEnv : null;

    const effectiveEnvIntensity = envConfig.useHdriLight ? envConfig.hdriOpacity : 0;
    if ('environmentIntensity' in refs.scene) {
      (refs.scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity =
        effectiveEnvIntensity;
    }

    if (refs.modelRoot) {
      refs.modelRoot.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        const orig = mesh.userData.originalMaterial || mesh.material;
        const list = Array.isArray(orig) ? orig : [orig];
        list.forEach((m: THREE.Material) => {
          const std = m as THREE.MeshStandardMaterial;
          if ('envMapIntensity' in std) {
            std.envMapIntensity = effectiveEnvIntensity;
            std.needsUpdate = true;
          }
        });
      });
    }

    const col = new THREE.Color(envConfig.backgroundColor);

    if (envConfig.showBackground && activeEnv) {
      refs.scene.background = activeEnv;
      if ('backgroundIntensity' in refs.scene) {
        (refs.scene as THREE.Scene & { backgroundIntensity: number }).backgroundIntensity =
          envConfig.hdriOpacity;
      }
      if ('backgroundBlurriness' in refs.scene) {
        (refs.scene as THREE.Scene & { backgroundBlurriness: number }).backgroundBlurriness =
          envConfig.backgroundBlurriness;
      }
      refs.scene.fog = null;
    } else {
      refs.scene.background = col;
      refs.scene.fog = new THREE.FogExp2(col.getHex(), 0.02);
    }

    refs.requestRender();
  }, [envConfig]);

  // Update Post-Processing Filters (Tone Mapping, Bloom, Sharpness, Brightness/Contrast, CA, Vignette, Color Balance)
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    refs.renderer.toneMapping = mapToneMappingConstant(postProcessingConfig.toneMapping);

    refs.bloomPass.enabled =
      postProcessingConfig.bloomEnabled && postProcessingConfig.bloomStrength > 0.001;
    refs.bloomPass.strength = postProcessingConfig.bloomStrength;
    refs.bloomPass.radius = postProcessingConfig.bloomRadius;
    refs.bloomPass.threshold = postProcessingConfig.bloomThreshold;

    const u = refs.gradingPass.uniforms;
    u.brightness.value = postProcessingConfig.brightness;
    u.contrast.value = postProcessingConfig.contrast;
    u.sharpness.value = postProcessingConfig.sharpness;
    u.chromaticAberration.value = postProcessingConfig.chromaticAberration;
    u.vignetteIntensity.value = postProcessingConfig.vignetteIntensity;
    u.vignetteOffset.value = postProcessingConfig.vignetteOffset;
    u.saturation.value = postProcessingConfig.saturation;
    u.temperature.value = postProcessingConfig.temperature;
    u.tint.value = postProcessingConfig.tint;
    u.balanceRGB.value.set(
      postProcessingConfig.balanceR,
      postProcessingConfig.balanceG,
      postProcessingConfig.balanceB
    );

    refs.requestRender();
  }, [postProcessingConfig]);

  // Update Camera Auto-Rotation settings
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    refs.controls.autoRotate = cameraConfig.autoRotate && !isSoftwareGl;
    refs.controls.autoRotateSpeed = cameraConfig.autoRotateSpeed;
    refs.ensureLoopState();
  }, [cameraConfig]);

  // Update Custom Model Base Color Override
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.modelRoot) return;

    refs.modelRoot.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const orig = mesh.userData.originalMaterial;
      if (!orig) return;

      const list = Array.isArray(orig) ? orig : [orig];
      list.forEach((m: THREE.Material) => {
        const std = m as THREE.MeshStandardMaterial;
        if (!std.color) return;
        if (materialColorConfig.overrideEnabled) {
          std.color.set(materialColorConfig.baseColor);
        } else if (std.userData.originalColor) {
          std.color.copy(std.userData.originalColor);
        }
        std.needsUpdate = true;
      });
    });

    refs.requestRender();
  }, [materialColorConfig.overrideEnabled, materialColorConfig.baseColor]);

  // Update Material Channel Inspection Mode (PBR, Wireframe, Normals, Roughness, Metalness)
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.modelRoot) return;

    refs.modelRoot.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const origMat = mesh.userData.originalMaterial;
      if (!origMat) return;

      if (mesh.userData.channelMaterial) {
        const prev = mesh.userData.channelMaterial;
        if (Array.isArray(prev)) prev.forEach((m) => m.dispose());
        else prev.dispose();
        mesh.userData.channelMaterial = null;
      }

      if (inspectionMode === 'pbr') {
        mesh.material = origMat;
        const list = Array.isArray(origMat) ? origMat : [origMat];
        list.forEach((m: THREE.Material) => {
          if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = false;
        });
      } else if (inspectionMode === 'wireframe') {
        mesh.material = origMat;
        const list = Array.isArray(origMat) ? origMat : [origMat];
        list.forEach((m: THREE.Material) => {
          if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = true;
        });
      } else if (inspectionMode === 'normals') {
        mesh.material = refs.normalMaterial;
      } else if (inspectionMode === 'roughness' || inspectionMode === 'metalness') {
        const primaryOrig = (
          Array.isArray(origMat) ? origMat[0] : origMat
        ) as THREE.MeshStandardMaterial;
        const val =
          inspectionMode === 'roughness'
            ? typeof primaryOrig.roughness === 'number'
              ? primaryOrig.roughness
              : 0.5
            : typeof primaryOrig.metalness === 'number'
              ? primaryOrig.metalness
              : 0.0;
        const channelMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color().setScalar(val),
          map:
            inspectionMode === 'roughness'
              ? primaryOrig.roughnessMap || null
              : primaryOrig.metalnessMap || null,
        });
        mesh.userData.channelMaterial = channelMat;
        mesh.material = channelMat;
      }
    });

    refs.requestRender();
  }, [inspectionMode]);

  // Smooth Damped Camera Preset Transitions
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !cameraPresetTrigger) return;

    const { preset } = cameraPresetTrigger;
    const dist = Math.max(refs.modelMaxDim * 1.5, 2.2);
    const targetY = refs.defaultCamTarget.y;

    _camGoalTarget.copy(refs.defaultCamTarget);

    if (preset === 'reset' || preset === 'free') {
      _camGoalPos.copy(refs.defaultCamPos);
    } else if (preset === 'isometric') {
      _camGoalPos.set(dist * 0.9, targetY + dist * 0.75, dist * 0.9);
    } else if (preset === 'front') {
      _camGoalPos.set(0, targetY + dist * 0.15, dist * 1.35);
    } else if (preset === 'top') {
      _camGoalPos.set(0.01, targetY + dist * 1.6, 0.01);
    }

    refs.cameraTransitionActive = true;
    refs.ensureLoopState();
  }, [cameraPresetTrigger]);

  // Animation Clip & Playback State
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs || !refs.mixer || refs.clips.length === 0) return;

    const desiredClip =
      refs.clips.find((c) => c.name === animationState.activeClip) || refs.clips[0];
    if (desiredClip) {
      const nextAction = refs.mixer.clipAction(desiredClip);
      if (refs.activeAction !== nextAction) {
        refs.activeAction?.stop();
        nextAction.reset().play();
        refs.activeAction = nextAction;
      }
    }

    refs.ensureLoopState();
  }, [animationState.activeClip, animationState.isPlaying, animationState.speed]);

  return (
    <div
      ref={canvasMountRef}
      className="fixed inset-0 w-full h-full overflow-hidden"
      aria-label="Interactive 3D WebGL Viewport"
    />
  );
};
