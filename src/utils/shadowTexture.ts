import * as THREE from 'three';
import { GroundGridMode } from '../types/viewer';

/**
 * Generates a soft radial contact shadow texture on an HTML5 2D canvas.
 * Blur controls the falloff gradient softness from center to edge.
 */
export function createRadialShadowTexture(
  blur: number,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  const half = size / 2;
  const clampedBlur = THREE.MathUtils.clamp(blur, 0.1, 4.0);
  const innerStop = THREE.MathUtils.clamp(0.32 / clampedBlur, 0.02, 0.48);
  const midStop = THREE.MathUtils.clamp(innerStop + 0.28 * (clampedBlur / 2.0), 0.25, 0.78);

  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
  gradient.addColorStop(innerStop, 'rgba(0, 0, 0, 0.72)');
  gradient.addColorStop(midStop, 'rgba(0, 0, 0, 0.26)');
  gradient.addColorStop(0.88, 'rgba(0, 0, 0, 0.05)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a high-resolution procedural ground grid & studio floor texture
 * supporting 'all' (textured floor + major/minor grid lines), 'grid-only', and 'floor-only'.
 * Includes a smooth radial alpha fade at the outer edge so it blends into the studio horizon.
 */
export function createGroundGridTexture(
  mode: GroundGridMode,
  floorColor: string,
  gridColor: string,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  if (mode === 'none') {
    const emptyTex = new THREE.CanvasTexture(canvas);
    emptyTex.colorSpace = THREE.SRGBColorSpace;
    return emptyTex;
  }

  const showFloor = mode === 'all' || mode === 'floor-only';
  const showGrid = mode === 'all' || mode === 'grid-only';

  // 1. Draw textured studio floor tiles if enabled
  if (showFloor) {
    ctx.fillStyle = floorColor;
    ctx.fillRect(0, 0, size, size);

    // Subtle alternating studio micro-tile bevel shading
    const cells = 16;
    const cellSize = size / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        } else {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }
    }
  }

  // 2. Draw crisp minor and major architectural grid lines if enabled
  if (showGrid) {
    const subDivisions = 32;
    const step = size / subDivisions;

    // Minor grid lines
    ctx.strokeStyle = gridColor;
    ctx.globalAlpha = showFloor ? 0.32 : 0.42;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= subDivisions; i++) {
      if (i % 4 === 0) continue;
      const pos = Math.round(i * step) + 0.5;
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
    }
    ctx.stroke();

    // Major grid lines (every 4th subdivision)
    ctx.globalAlpha = showFloor ? 0.72 : 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= subDivisions; i += 4) {
      const pos = Math.round(i * step);
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
    }
    ctx.stroke();

    // Center origin crosshair accent
    const center = size / 2;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, size);
    ctx.moveTo(0, center);
    ctx.lineTo(size, center);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // 3. Apply smooth circular horizon fade-out mask using destination-in compositing
  ctx.globalCompositeOperation = 'destination-in';
  const half = size / 2;
  const fadeGrad = ctx.createRadialGradient(half, half, half * 0.15, half, half, half * 0.98);
  fadeGrad.addColorStop(0.0, 'rgba(0, 0, 0, 1.0)');
  fadeGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.92)');
  fadeGrad.addColorStop(0.82, 'rgba(0, 0, 0, 0.38)');
  fadeGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = fadeGrad;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a procedural equirectangular studio environment texture
 * for offline Warm Sunset or Neutral Studio lighting presets.
 */
export function createProceduralEnvTexture(
  variant: 'neutral' | 'warm',
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  if (variant === 'warm') {
    bgGrad.addColorStop(0.0, '#1e293b');
    bgGrad.addColorStop(0.42, '#7c2d12');
    bgGrad.addColorStop(0.5, '#f97316');
    bgGrad.addColorStop(0.56, '#332218');
    bgGrad.addColorStop(1.0, '#0f0d0c');
  } else {
    bgGrad.addColorStop(0.0, '#2c3038');
    bgGrad.addColorStop(0.48, '#404550');
    bgGrad.addColorStop(0.52, '#22252a');
    bgGrad.addColorStop(1.0, '#121316');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const softboxes =
    variant === 'warm'
      ? [
          { x: width * 0.28, y: height * 0.34, rx: 140, ry: 70, color: 'rgba(255, 232, 195, 0.92)' },
          { x: width * 0.74, y: height * 0.26, rx: 110, ry: 55, color: 'rgba(186, 230, 253, 0.65)' },
          { x: width * 0.5, y: height * 0.14, rx: 220, ry: 38, color: 'rgba(255, 247, 237, 0.7)' },
        ]
      : [
          { x: width * 0.25, y: height * 0.28, rx: 150, ry: 75, color: 'rgba(255, 255, 255, 0.9)' },
          { x: width * 0.75, y: height * 0.32, rx: 130, ry: 65, color: 'rgba(226, 232, 240, 0.75)' },
          { x: width * 0.5, y: height * 0.12, rx: 240, ry: 40, color: 'rgba(248, 250, 252, 0.8)' },
        ];

  for (const box of softboxes) {
    ctx.save();
    ctx.translate(box.x, box.y);
    ctx.scale(1, box.ry / box.rx);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, box.rx);
    grad.addColorStop(0, box.color);
    grad.addColorStop(0.6, box.color.replace(/[\d.]+\)$/, '0.25)'));
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, box.rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}
