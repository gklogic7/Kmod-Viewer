import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { USDZLoader } from 'three/addons/loaders/USDZLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { LoadedGltfAsset } from '../types/viewer';
import { resolveGltfResourceUrl } from './fileIngest';

export interface UniversalModelResult {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  missingTextures: string[];
}

/**
 * Converts non-PBR materials (such as Phong/Lambert from FBX, OBJ, Collada, or 3MF)
 * or untextured geometries into clean studio MeshStandardMaterials while preserving maps & colors.
 */
function upgradeMaterialsForPbrStudio(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;

    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      mesh.frustumCulled = false;
    }

    if (mesh.geometry && !mesh.geometry.attributes.normal) {
      mesh.geometry.computeVertexNormals();
    }

    const convertSingleMaterial = (mat: THREE.Material | undefined | null): THREE.Material => {
      if (!mat) {
        return new THREE.MeshStandardMaterial({
          color: 0xd4d8e0,
          roughness: 0.38,
          metalness: 0.12,
        });
      }

      if (
        (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial ||
        (mat as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial
      ) {
        return mat;
      }

      const legacy = mat as THREE.MeshPhongMaterial & {
        map?: THREE.Texture | null;
        normalMap?: THREE.Texture | null;
        bumpMap?: THREE.Texture | null;
        emissive?: THREE.Color;
        emissiveMap?: THREE.Texture | null;
        shininess?: number;
      };

      const hasVertexColors = Boolean(mesh.geometry?.attributes?.color);
      const shininess = typeof legacy.shininess === 'number' ? legacy.shininess : 30;
      const estimatedRoughness = THREE.MathUtils.clamp(1.0 - shininess / 120, 0.18, 0.85);

      const std = new THREE.MeshStandardMaterial({
        name: legacy.name || 'Upgraded_Studio_Material',
        color: legacy.color ? legacy.color.clone() : new THREE.Color(0xd4d8e0),
        map: legacy.map || null,
        normalMap: legacy.normalMap || null,
        bumpMap: legacy.bumpMap || null,
        emissive: legacy.emissive ? legacy.emissive.clone() : new THREE.Color(0x000000),
        emissiveMap: legacy.emissiveMap || null,
        roughness: estimatedRoughness,
        metalness: 0.1,
        transparent: Boolean(legacy.transparent),
        opacity: typeof legacy.opacity === 'number' ? legacy.opacity : 1.0,
        side: legacy.side ?? THREE.FrontSide,
        vertexColors: hasVertexColors || Boolean(legacy.vertexColors),
      });

      return std;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => convertSingleMaterial(m));
    } else {
      mesh.material = convertSingleMaterial(mesh.material);
    }
  });
}

/**
 * Universal 3D format loader supporting:
 * - glTF 2.0 (.glb, .gltf + Draco + Meshopt)
 * - Apple USDZ (.usdz)
 * - Autodesk FBX (.fbx with skeletal/keyframe animations)
 * - Wavefront OBJ + MTL (.obj, .mtl)
 * - Stereolithography STL (.stl)
 * - Polygon File Format PLY (.ply)
 * - COLLADA (.dae with animations)
 * - 3D Manufacturing Format (.3mf)
 */
export async function loadUniversal3DModel(
  asset: LoadedGltfAsset
): Promise<UniversalModelResult> {
  const runtimeMissing = new Set<string>(asset.missingTextures || []);

  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) =>
    resolveGltfResourceUrl(url, asset.rootFileUrl, asset.resourceMap, (missing) => {
      runtimeMissing.add(missing);
    })
  );

  const format = asset.format;

  // 1. glTF / GLB (with Draco & Meshopt support)
  if (format === 'glb' || format === 'gltf') {
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

    const loader = new GLTFLoader(manager);
    loader.setDRACOLoader(dracoLoader);
    loader.setMeshoptDecoder(MeshoptDecoder);

    try {
      const gltf = await loader.loadAsync(asset.rootFileUrl);
      dracoLoader.dispose();
      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) {
        throw new Error('The uploaded glTF/GLB file does not contain a valid 3D scene.');
      }
      root.traverse((obj) => {
        if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
          obj.frustumCulled = false;
        }
      });
      return {
        scene: root,
        animations: gltf.animations || [],
        missingTextures: Array.from(runtimeMissing),
      };
    } catch (err) {
      dracoLoader.dispose();
      throw err;
    }
  }

  // 2. Apple USDZ (.usdz)
  if (format === 'usdz') {
    const loader = new USDZLoader(manager);
    const group = await loader.loadAsync(asset.rootFileUrl);
    upgradeMaterialsForPbrStudio(group);
    const clips = (group as THREE.Object3D & { animations?: THREE.AnimationClip[] }).animations || [];
    return {
      scene: group,
      animations: clips,
      missingTextures: Array.from(runtimeMissing),
    };
  }

  // 3. Autodesk FBX (.fbx)
  if (format === 'fbx') {
    const loader = new FBXLoader(manager);
    const group = await loader.loadAsync(asset.rootFileUrl);
    upgradeMaterialsForPbrStudio(group);
    return {
      scene: group,
      animations: group.animations || [],
      missingTextures: Array.from(runtimeMissing),
    };
  }

  // 4. Wavefront OBJ (+ optional companion .mtl)
  if (format === 'obj') {
    const objLoader = new OBJLoader(manager);
    if (asset.mtlFileUrl) {
      try {
        const mtlLoader = new MTLLoader(manager);
        const materials = await mtlLoader.loadAsync(asset.mtlFileUrl);
        materials.preload();
        objLoader.setMaterials(materials);
      } catch {
        // Fallback to default studio material if .mtl fails to parse
      }
    }
    const group = await objLoader.loadAsync(asset.rootFileUrl);
    upgradeMaterialsForPbrStudio(group);
    return {
      scene: group,
      animations: group.animations || [],
      missingTextures: Array.from(runtimeMissing),
    };
  }

  // 5. Stereolithography STL (.stl)
  if (format === 'stl') {
    const loader = new STLLoader(manager);
    const geometry = await loader.loadAsync(asset.rootFileUrl);
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }
    const hasColors = Boolean(geometry.attributes.color);
    const material = new THREE.MeshStandardMaterial({
      name: 'STL_Studio_Material',
      color: 0xd4d8e0,
      roughness: 0.34,
      metalness: 0.22,
      vertexColors: hasColors,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = asset.rootFileName.replace(/\.stl$/i, '') || 'STL_Mesh';
    const group = new THREE.Group();
    group.add(mesh);
    return {
      scene: group,
      animations: [],
      missingTextures: [],
    };
  }

  // 6. Polygon File Format PLY (.ply)
  if (format === 'ply') {
    const loader = new PLYLoader(manager);
    const geometry = await loader.loadAsync(asset.rootFileUrl);
    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }
    const hasColors = Boolean(geometry.attributes.color);
    const material = new THREE.MeshStandardMaterial({
      name: 'PLY_Studio_Material',
      color: hasColors ? 0xffffff : 0xd4d8e0,
      roughness: 0.36,
      metalness: 0.15,
      vertexColors: hasColors,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = asset.rootFileName.replace(/\.ply$/i, '') || 'PLY_Mesh';
    const group = new THREE.Group();
    group.add(mesh);
    return {
      scene: group,
      animations: [],
      missingTextures: [],
    };
  }

  // 7. COLLADA (.dae)
  if (format === 'dae') {
    const loader = new ColladaLoader(manager);
    const collada = await loader.loadAsync(asset.rootFileUrl);
    const scene = collada?.scene || new THREE.Group();
    upgradeMaterialsForPbrStudio(scene);
    const animations =
      (collada as unknown as { animations?: THREE.AnimationClip[] } | null)?.animations ||
      scene.animations ||
      [];
    return {
      scene,
      animations,
      missingTextures: Array.from(runtimeMissing),
    };
  }

  // 8. 3D Manufacturing Format (.3mf)
  if (format === '3mf') {
    const loader = new ThreeMFLoader(manager);
    const group = await loader.loadAsync(asset.rootFileUrl);
    upgradeMaterialsForPbrStudio(group);
    return {
      scene: group,
      animations: group.animations || [],
      missingTextures: Array.from(runtimeMissing),
    };
  }

  throw new Error(`Unsupported 3D format: ${format}`);
}
