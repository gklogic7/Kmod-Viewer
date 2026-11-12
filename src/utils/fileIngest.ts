import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { LoadedGltfAsset } from '../types/viewer';

export interface IngestResult {
  gltfAsset?: LoadedGltfAsset;
  environmentFile?: File;
  textureFiles?: File[];
  error?: string;
}

/**
 * Recursively traverses DataTransferItemList (files or folders) into a Map of relative path -> File.
 */
export async function extractFilesFromDataTransfer(
  items: DataTransferItemList
): Promise<Map<string, File>> {
  const fileMap = new Map<string, File>();

  const traverseEntry = async (entry: FileSystemEntry, pathPrefix = ''): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      const fullPath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
      fileMap.set(fullPath, file);
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries: FileSystemEntry[] = [];

      const readBatch = async (): Promise<void> => {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
        if (batch.length > 0) {
          entries.push(...batch);
          await readBatch();
        }
      };

      await readBatch();
      const nextPrefix = pathPrefix ? `${pathPrefix}/${dirEntry.name}` : dirEntry.name;
      for (const child of entries) {
        await traverseEntry(child, nextPrefix);
      }
    }
  };

  // Capture entries synchronously before awaiting promises (required by browsers for DataTransferItemList)
  const entriesToProcess: { entry: FileSystemEntry | null; fallbackFile: File | null }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
      const fallbackFile = item.getAsFile();
      entriesToProcess.push({ entry, fallbackFile });
    }
  }

  await Promise.all(
    entriesToProcess.map(async ({ entry, fallbackFile }) => {
      if (entry) {
        await traverseEntry(entry);
      } else if (fallbackFile) {
        fileMap.set(fallbackFile.name, fallbackFile);
      }
    })
  );

  return fileMap;
}

/**
 * Converts a standard FileList from <input type="file" multiple> into a path -> File Map.
 */
export function extractFilesFromFileList(fileList: FileList): Map<string, File> {
  const fileMap = new Map<string, File>();
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const relPath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    fileMap.set(relPath, file);
  }
  return fileMap;
}

let cachedUvCheckerBlobUrl: string | null = null;
let cachedNormalBlobUrl: string | null = null;
let cachedMetallicRoughnessBlobUrl: string | null = null;
let cachedEmptyBinBlobUrl: string | null = null;

function canvasToBlobUrl(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL('image/png');
  const binStr = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'image/png' });
  return URL.createObjectURL(blob);
}

/**
 * Creates a visible studio UV grid texture fallback when an external baseColor texture file
 * was not included with a .gltf upload, so the model still displays crisp UV surface detail.
 */
function getFallbackBaseColorBlobUrl(): string {
  if (cachedUvCheckerBlobUrl) return cachedUvCheckerBlobUrl;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cells = 8;
  const cellSize = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#d4d8e0' : '#9ca3af';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  cachedUvCheckerBlobUrl = canvasToBlobUrl(canvas);
  return cachedUvCheckerBlobUrl;
}

function getFallbackNormalBlobUrl(): string {
  if (cachedNormalBlobUrl) return cachedNormalBlobUrl;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(128, 128, 255)';
  ctx.fillRect(0, 0, 8, 8);
  cachedNormalBlobUrl = canvasToBlobUrl(canvas);
  return cachedNormalBlobUrl;
}

function getFallbackDataMapBlobUrl(): string {
  if (cachedMetallicRoughnessBlobUrl) return cachedMetallicRoughnessBlobUrl;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.fillRect(0, 0, 8, 8);
  cachedMetallicRoughnessBlobUrl = canvasToBlobUrl(canvas);
  return cachedMetallicRoughnessBlobUrl;
}

function getFallbackBinBlobUrl(): string {
  if (!cachedEmptyBinBlobUrl) {
    const buffer = new ArrayBuffer(4 * 1024 * 1024);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    cachedEmptyBinBlobUrl = URL.createObjectURL(blob);
  }
  return cachedEmptyBinBlobUrl;
}

/**
 * Resolves any URL requested by THREE.GLTFLoader against the uploaded local file map.
 */
export function resolveGltfResourceUrl(
  url: string,
  rootFileUrl: string,
  resourceMap: Map<string, string>,
  onMissingResource?: (missingPath: string) => void
): string {
  if (!url || url === rootFileUrl || url.startsWith('data:')) {
    return url;
  }

  for (const mappedBlob of resourceMap.values()) {
    if (url === mappedBlob) return url;
  }

  let cleaned = url;
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    // ignore malformed URI encoding
  }
  cleaned = cleaned
    .replace(/^blob:https?:\/\/[^/]+\//i, '')
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/\\/g, '/')
    .replace(/^(\.\/|\/)+/, '');

  const fileName = cleaned.split('/').pop() || cleaned;

  const candidates = [
    cleaned,
    cleaned.toLowerCase(),
    fileName,
    fileName.toLowerCase(),
  ];

  for (const key of candidates) {
    if (resourceMap.has(key)) {
      return resourceMap.get(key)!;
    }
  }

  const lowerCleaned = cleaned.toLowerCase();
  for (const [k, blobUrl] of resourceMap.entries()) {
    if (k.endsWith('/' + lowerCleaned) || lowerCleaned.endsWith('/' + k)) {
      return blobUrl;
    }
  }

  if (/\.(png|jpe?g|webp|gif|bmp|avif|tga)(\?.*)?$/i.test(cleaned)) {
    onMissingResource?.(cleaned);
    if (/normal|norm|nrm/i.test(fileName)) {
      return getFallbackNormalBlobUrl();
    }
    if (/rough|metal|orm|occ|ao|spec/i.test(fileName)) {
      return getFallbackDataMapBlobUrl();
    }
    return getFallbackBaseColorBlobUrl();
  }

  if (/\.bin(\?.*)?$/i.test(cleaned)) {
    onMissingResource?.(cleaned);
    return getFallbackBinBlobUrl();
  }

  return getFallbackBaseColorBlobUrl();
}

/**
 * Classifies uploaded files into a primary glTF/GLB asset (with companion .bin / textures),
 * a custom .hdr / .exr environment map, or standalone texture images (.png, .jpg, .webp).
 */
export async function processUploadedFileMap(fileMap: Map<string, File>): Promise<IngestResult> {
  let rootGltfPath: string | null = null;
  let rootGltfFile: File | null = null;
  let environmentFile: File | null = null;
  const standaloneTextures: File[] = [];

  for (const [path, file] of fileMap.entries()) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
      if (!rootGltfFile || lower.endsWith('.glb')) {
        rootGltfPath = path;
        rootGltfFile = file;
      }
    } else if (lower.endsWith('.hdr') || lower.endsWith('.exr')) {
      environmentFile = file;
    } else if (/\.(png|jpe?g|webp)$/i.test(lower)) {
      standaloneTextures.push(file);
    }
  }

  if (!rootGltfFile && !environmentFile && standaloneTextures.length === 0) {
    return {
      error:
        'No valid .gltf, .glb, .hdr, .exr, or texture image (.png, .jpg, .webp) found.',
    };
  }

  let gltfAsset: LoadedGltfAsset | undefined;

  if (rootGltfFile && rootGltfPath) {
    const resourceMap = new Map<string, string>();
    const normalizedRootPath = rootGltfPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const rootDir = normalizedRootPath.includes('/')
      ? normalizedRootPath.substring(0, normalizedRootPath.lastIndexOf('/') + 1)
      : '';

    for (const [path, file] of fileMap.entries()) {
      const blobUrl = URL.createObjectURL(file);
      const normalizedFull = path.replace(/\\/g, '/').replace(/^\/+/, '');
      const baseName = normalizedFull.split('/').pop() || normalizedFull;
      resourceMap.set(normalizedFull, blobUrl);
      resourceMap.set(normalizedFull.toLowerCase(), blobUrl);
      resourceMap.set(baseName, blobUrl);
      resourceMap.set(baseName.toLowerCase(), blobUrl);

      if (rootDir && normalizedFull.startsWith(rootDir)) {
        const relativeToRoot = normalizedFull.slice(rootDir.length);
        resourceMap.set(relativeToRoot, blobUrl);
        resourceMap.set(relativeToRoot.toLowerCase(), blobUrl);
      }
    }

    const missingTexturesSet = new Set<string>();
    let rootFileUrl =
      resourceMap.get(normalizedRootPath) || URL.createObjectURL(rootGltfFile);

    // Pre-parse .gltf JSON so relative image & buffer URIs are rewritten directly to valid Blob URLs
    if (rootGltfFile.name.toLowerCase().endsWith('.gltf')) {
      try {
        const rawText = await rootGltfFile.text();
        const json = JSON.parse(rawText);

        if (Array.isArray(json.buffers)) {
          for (const buf of json.buffers) {
            if (typeof buf.uri === 'string' && !buf.uri.startsWith('data:')) {
              buf.uri = resolveGltfResourceUrl(buf.uri, rootFileUrl, resourceMap);
            }
          }
        }

        if (Array.isArray(json.images)) {
          for (const img of json.images) {
            if (typeof img.uri === 'string' && !img.uri.startsWith('data:')) {
              img.uri = resolveGltfResourceUrl(img.uri, rootFileUrl, resourceMap, (missing) => {
                missingTexturesSet.add(missing);
              });
            }
          }
        }

        const rewrittenBlob = new Blob([JSON.stringify(json)], {
          type: 'model/gltf+json',
        });
        rootFileUrl = URL.createObjectURL(rewrittenBlob);
        resourceMap.set('__rewritten_root_gltf__', rootFileUrl);
      } catch {
        // Fallback to standard URL modifier if JSON parsing fails
      }
    }

    let rawGlbBuffer: ArrayBuffer | null = null;
    if (
      rootGltfFile.name.toLowerCase().endsWith('.glb') &&
      rootGltfFile.size <= 15 * 1024 * 1024
    ) {
      rawGlbBuffer = await rootGltfFile.arrayBuffer();
    }

    gltfAsset = {
      rootFileUrl,
      rootFileName: rootGltfFile.name,
      fileSize: rootGltfFile.size,
      rawGlbBuffer,
      resourceMap,
      missingTextures: Array.from(missingTexturesSet),
    };
  }

  return {
    gltfAsset,
    environmentFile: environmentFile || undefined,
    textureFiles: !rootGltfFile && standaloneTextures.length > 0 ? standaloneTextures : undefined,
  };
}

/**
 * Creates a procedural dial/chapter-ring texture for the sample GLB model
 * so textures are visibly demonstrated out of the box.
 */
function createSampleModelTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, size, size);

  // Subtle concentric rings and radial tick marks
  const cx = size / 2;
  const cy = size / 2;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const r1 = i % 3 === 0 ? size * 0.34 : size * 0.38;
    const r2 = size * 0.42;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds a 9-part composite procedural 3D studio chronometer / gyroscope assembly
 * with embedded procedural textures and exports it to a real binary .glb file.
 */
export async function generateSampleGlbBuffer(): Promise<ArrayBuffer> {
  const group = new THREE.Group();
  group.name = 'KMod_Gyro_Chronometer';

  const dialTexture = createSampleModelTexture();

  const matBrushedTitanium = new THREE.MeshStandardMaterial({
    name: 'Brushed_Titanium_Base',
    color: new THREE.Color(0x94a3b8),
    metalness: 0.85,
    roughness: 0.25,
  });

  const matTexturedPlinth = new THREE.MeshStandardMaterial({
    name: 'Textured_Chronometer_Dial',
    color: new THREE.Color(0xffffff),
    map: dialTexture,
    metalness: 0.25,
    roughness: 0.55,
  });

  const matPolishedGold = new THREE.MeshStandardMaterial({
    name: 'Polished_Gold_Gimbal',
    color: new THREE.Color(0xf59e0b),
    metalness: 0.94,
    roughness: 0.14,
  });

  const matCopperCoil = new THREE.MeshStandardMaterial({
    name: 'Satin_Copper_Core',
    color: new THREE.Color(0xea580c),
    metalness: 0.8,
    roughness: 0.38,
  });

  const matTexturedRotor = new THREE.MeshStandardMaterial({
    name: 'Precision_Textured_Rotor',
    color: new THREE.Color(0xffffff),
    map: dialTexture,
    metalness: 0.15,
    roughness: 0.42,
  });

  // 1. Primary Silhouette: Stepped Lathe Pedestal Base (flush at y = 0)
  const lathePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.95, 0.0),
    new THREE.Vector2(0.92, 0.08),
    new THREE.Vector2(0.78, 0.14),
    new THREE.Vector2(0.72, 0.24),
    new THREE.Vector2(0.45, 0.28),
    new THREE.Vector2(0.0, 0.28),
  ];
  const baseGeo = new THREE.LatheGeometry(lathePoints, 48);
  const baseMesh = new THREE.Mesh(baseGeo, matBrushedTitanium);
  baseMesh.name = 'Pedestal_Base';
  group.add(baseMesh);

  // 2. Secondary Read: Textured Chronometer Plinth Ring
  const plinthGeo = new THREE.CylinderGeometry(0.62, 0.68, 0.12, 40);
  plinthGeo.translate(0, 0.34, 0);
  const plinthMesh = new THREE.Mesh(plinthGeo, matTexturedPlinth);
  plinthMesh.name = 'Damping_Plinth';
  group.add(plinthMesh);

  // 3. Beveled Extruded Support Yoke (Arch)
  const archShape = new THREE.Shape();
  archShape.absarc(0, 0, 1.05, Math.PI, 0, false);
  archShape.absarc(0, 0, 0.9, 0, Math.PI, true);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.14,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  };
  const yokeGeo = new THREE.ExtrudeGeometry(archShape, extrudeSettings);
  yokeGeo.center();
  yokeGeo.rotateX(Math.PI);
  yokeGeo.translate(0, 1.02, 0);
  const yokeMesh = new THREE.Mesh(yokeGeo, matBrushedTitanium);
  yokeMesh.name = 'Support_Yoke_Arch';
  group.add(yokeMesh);

  // 4. Central Vertical Spindle Column
  const spindleGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.42, 24);
  spindleGeo.translate(0, 0.56, 0);
  const spindleMesh = new THREE.Mesh(spindleGeo, matTexturedPlinth);
  spindleMesh.name = 'Spindle_Column';
  group.add(spindleMesh);

  // 5. Outer Gold Gimbal Torus
  const outerGimbalGeo = new THREE.TorusGeometry(0.76, 0.055, 24, 64);
  const outerGimbalMesh = new THREE.Mesh(outerGimbalGeo, matPolishedGold);
  outerGimbalMesh.position.set(0, 1.28, 0);
  outerGimbalMesh.rotation.set(0.25, 0.4, 0);
  outerGimbalMesh.name = 'Outer_Gold_Gimbal';
  group.add(outerGimbalMesh);

  // 6. Inner Copper Gimbal Ring
  const innerGimbalGeo = new THREE.TorusGeometry(0.54, 0.045, 20, 48);
  const innerGimbalMesh = new THREE.Mesh(innerGimbalGeo, matCopperCoil);
  innerGimbalMesh.position.set(0, 1.28, 0);
  innerGimbalMesh.rotation.set(-0.45, -0.3, 0.25);
  innerGimbalMesh.name = 'Inner_Copper_Gimbal';
  group.add(innerGimbalMesh);

  // 7. Precision Textured Rotor Core
  const rotorGeo = new THREE.SphereGeometry(0.32, 32, 24);
  const rotorMesh = new THREE.Mesh(rotorGeo, matTexturedRotor);
  rotorMesh.position.set(0, 1.28, 0);
  rotorMesh.scale.set(1, 0.78, 1);
  rotorMesh.name = 'Textured_Rotor_Core';
  group.add(rotorMesh);

  // 8. Equatorial Flywheel Collar
  const flywheelGeo = new THREE.TorusGeometry(0.36, 0.035, 16, 48);
  flywheelGeo.rotateX(Math.PI / 2);
  const flywheelMesh = new THREE.Mesh(flywheelGeo, matPolishedGold);
  flywheelMesh.position.set(0, 1.28, 0);
  flywheelMesh.name = 'Equatorial_Flywheel';
  group.add(flywheelMesh);

  // 9. Accent Detail: Helical Telemetry Conduit (TubeGeometry)
  const curvePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const angle = t * Math.PI * 2;
    curvePoints.push(
      new THREE.Vector3(
        Math.cos(angle) * 0.84,
        0.16 + Math.sin(angle * 3) * 0.03,
        Math.sin(angle) * 0.84
      )
    );
  }
  const conduitCurve = new THREE.CatmullRomCurve3(curvePoints, true);
  const conduitGeo = new THREE.TubeGeometry(conduitCurve, 64, 0.022, 12, true);
  const conduitMesh = new THREE.Mesh(conduitGeo, matCopperCoil);
  conduitMesh.name = 'Helical_Conduit_Ring';
  group.add(conduitMesh);

  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          reject(new Error('Expected binary GLB ArrayBuffer output'));
        }
      },
      (err) => reject(err),
      { binary: true }
    );
  });

  return arrayBuffer;
}
