import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Sun,
  Layers,
  Camera,
  Palette,
  Play,
  Pause,
  Upload,
  RotateCcw,
  RefreshCw,
  Grid,
  Sparkles,
  Film,
  Bone,
} from 'lucide-react';
import {
  AnimationLoopMode,
  AnimationState,
  CameraConfig,
  CameraPreset,
  EnvironmentConfig,
  EnvironmentPreset,
  GroundGridMode,
  InspectionMode,
  MaterialColorConfig,
  ModelMetadata,
  PostProcessingConfig,
  PostProcessingPreset,
  ShadowConfig,
  ToneMappingMode,
} from '../types/viewer';

interface BottomControlDockProps {
  dockCollapsed: boolean;
  onToggleCollapse: () => void;
  shadowConfig: ShadowConfig;
  onUpdateShadow: (patch: Partial<ShadowConfig>) => void;
  envConfig: EnvironmentConfig;
  onUpdateEnv: (patch: Partial<EnvironmentConfig>) => void;
  cameraConfig: CameraConfig;
  onUpdateCamera: (patch: Partial<CameraConfig>) => void;
  materialColorConfig: MaterialColorConfig;
  onUpdateMaterialColor: (patch: Partial<MaterialColorConfig>) => void;
  postProcessingConfig: PostProcessingConfig;
  onUpdatePostProcessing: (patch: Partial<PostProcessingConfig>) => void;
  onApplyPostPreset: (preset: PostProcessingPreset) => void;
  onUploadHdrClick: () => void;
  onUploadTextureClick: () => void;
  inspectionMode: InspectionMode;
  onSelectInspectionMode: (mode: InspectionMode) => void;
  onTriggerCameraPreset: (preset: CameraPreset) => void;
  modelMetadata: ModelMetadata | null;
  animationState: AnimationState;
  onUpdateAnimation: (patch: Partial<AnimationState>) => void;
}

type ActiveTab = 'shadow' | 'hdri' | 'postfx' | 'colors' | 'shading' | 'animation' | 'camera';
type PostFxSubSection = 'effects' | 'colorbalance';

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  dockCollapsed,
  onToggleCollapse,
  shadowConfig,
  onUpdateShadow,
  envConfig,
  onUpdateEnv,
  cameraConfig,
  onUpdateCamera,
  materialColorConfig,
  onUpdateMaterialColor,
  postProcessingConfig,
  onUpdatePostProcessing,
  onApplyPostPreset,
  onUploadHdrClick,
  onUploadTextureClick,
  inspectionMode,
  onSelectInspectionMode,
  onTriggerCameraPreset,
  modelMetadata,
  animationState,
  onUpdateAnimation,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('shadow');
  const [postFxSubSection, setPostFxSubSection] = useState<PostFxSubSection>('effects');

  const inspectionOptions: { id: InspectionMode; label: string }[] = [
    { id: 'pbr', label: 'PBR Lit' },
    { id: 'wireframe', label: 'Wireframe' },
    { id: 'normals', label: 'Normals' },
    { id: 'roughness', label: 'Roughness' },
    { id: 'metalness', label: 'Metalness' },
  ];

  const envPresets: { id: EnvironmentPreset; label: string }[] = [
    { id: 'studio', label: 'Studio' },
    { id: 'neutral', label: 'Neutral' },
    { id: 'warm', label: 'Warm' },
  ];

  const gridModes: { id: GroundGridMode; label: string }[] = [
    { id: 'all', label: 'All (Grid + Floor)' },
    { id: 'grid-only', label: 'Grid Lines' },
    { id: 'floor-only', label: 'Tiled Floor' },
    { id: 'none', label: 'Grid Off' },
  ];

  const postPresets: { id: PostProcessingPreset; label: string }[] = [
    { id: 'studio', label: 'Studio' },
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'crisp', label: 'Crisp' },
    { id: 'glow', label: 'Glow' },
    { id: 'reset', label: 'Reset' },
  ];

  const toneMappingModes: { id: ToneMappingMode; label: string }[] = [
    { id: 'aces', label: 'ACES Filmic' },
    { id: 'agx', label: 'AgX' },
    { id: 'neutral', label: 'Neutral' },
    { id: 'reinhard', label: 'Reinhard' },
    { id: 'cineon', label: 'Cineon' },
    { id: 'linear', label: 'Linear' },
  ];

  const hasAnimations = Boolean(modelMetadata && modelMetadata.animations.length > 0);
  const hasSkeleton = Boolean(modelMetadata && modelMetadata.hasSkeleton);

  return (
    <section
      aria-label="3D Scene Controls"
      className="fixed bottom-[34px] left-1/2 -translate-x-1/2 z-20 w-[min(1020px,96vw)] flex flex-col items-center pointer-events-none"
    >
      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-1 rounded-t-lg bg-[#222222] border border-b-0 border-white/10 text-[11px] font-medium text-[#b5b5b5] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
        title="Minimize or Expand Controls (Shortcut: H)"
      >
        {dockCollapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Show Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Minimize Controls</span>
          </>
        )}
      </button>

      {/* Main Dock Container — Solid surface (no backdrop-filter over WebGL) */}
      {!dockCollapsed && (
        <div className="pointer-events-auto w-full bg-[#202020] border border-white/10 rounded-xl px-3.5 py-2.5 shadow-2xl flex flex-col gap-2.5">
          {/* Top Segmented Category Row */}
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-2 overflow-x-auto">
            <div className="flex items-center gap-1 bg-[#171717] p-1 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('shadow')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'shadow'
                    ? 'bg-[#323232] text-white'
                    : 'text-[#9e9e9e] hover:text-[#e5e5e5]'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Shadow &amp; Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('hdri')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'hdri'
                    ? 'bg-[#323232] text-white'
                    : 'text-[#9e9e9e] hover:text-[#e5e5e5]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>HDRI &amp; Light</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('postfx')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'postfx'
                    ? 'bg-[#323232] text-white'
                    : 'text-[#9e9e9e] hover:text-[#e5e5e5]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Post-FX</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('colors')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'colors'
                    ? 'bg-[#323232] text-white'
                    : 'text-[#9e9e9e] hover:text-[#e5e5e5]'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Colors &amp; Texture</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('shading')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'shading'
                    ? 'bg-[#323232] text-white'
                    : 'text-[#9e9e9e] hover:text-[#e5e5e5]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Channels</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('animation')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'animation'
                    ? 'bg-[#323232] text-white'
                    : 'text-[#9e9e9e] hover:text-[#e5e5e5]'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>
                  Animation{hasAnimations ? ` (${modelMetadata!.animations.length})` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('camera')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'camera'
                    ? 'bg-[#323232] text-white'
                    : 'text-[#9e9e9e] hover:text-[#e5e5e5]'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Camera</span>
              </button>
            </div>

            {/* Right-side active metadata summary (unboxed clean text with · separators) */}
            {modelMetadata && (
              <div className="hidden lg:flex items-center gap-2 text-[11px] text-[#9e9e9e] font-mono-tabular whitespace-nowrap shrink-0">
                <span className="text-[#3b82f6] uppercase font-semibold">
                  {modelMetadata.format}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#d4d4d4] truncate max-w-[130px]">
                  {modelMetadata.fileName}
                </span>
                <span aria-hidden="true">·</span>
                <span>{modelMetadata.meshCount} meshes</span>
                <span aria-hidden="true">·</span>
                <span>{modelMetadata.triangleCount.toLocaleString()} tris</span>
              </div>
            )}
          </div>

          {/* Tab Content Row */}
          <div className="min-h-[40px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
            {activeTab === 'shadow' && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onUpdateShadow({ enabled: !shadowConfig.enabled })}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      shadowConfig.enabled
                        ? 'bg-[#3b82f6] text-white'
                        : 'bg-[#2c2c2c] text-[#9e9e9e] hover:text-white'
                    }`}
                  >
                    {shadowConfig.enabled ? 'Shadow: On' : 'Shadow: Off'}
                  </button>

                  {gridModes.map((gm) => (
                    <button
                      key={gm.id}
                      type="button"
                      onClick={() => onUpdateShadow({ gridMode: gm.id })}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        shadowConfig.gridMode === gm.id
                          ? 'bg-[#323232] text-white border border-white/20'
                          : 'bg-[#252525] text-[#9e9e9e] hover:text-white'
                      }`}
                    >
                      {gm.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-[#bdbdbd] whitespace-nowrap">
                    <span>Opacity</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      disabled={!shadowConfig.enabled}
                      value={shadowConfig.opacity}
                      onChange={(e) =>
                        onUpdateShadow({ opacity: parseFloat(e.target.value) })
                      }
                      className="studio-slider w-20 sm:w-24"
                    />
                    <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-8 text-right">
                      {Math.round(shadowConfig.opacity * 100)}%
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-[#bdbdbd] whitespace-nowrap">
                    <span>Blur</span>
                    <input
                      type="range"
                      min={0.2}
                      max={3.5}
                      step={0.1}
                      disabled={!shadowConfig.enabled}
                      value={shadowConfig.blur}
                      onChange={(e) => onUpdateShadow({ blur: parseFloat(e.target.value) })}
                      className="studio-slider w-20 sm:w-24"
                    />
                    <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-7 text-right">
                      {shadowConfig.blur.toFixed(1)}
                    </span>
                  </label>
                </div>
              </>
            )}

            {activeTab === 'hdri' && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateEnv({ useHdriLight: !envConfig.useHdriLight })
                    }
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      envConfig.useHdriLight
                        ? 'bg-[#3b82f6] text-white'
                        : 'bg-[#2c2c2c] text-[#9e9e9e] hover:text-white'
                    }`}
                  >
                    {envConfig.useHdriLight ? 'HDRI Light: On' : 'HDRI Light: Off'}
                  </button>

                  {envPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onUpdateEnv({ preset: p.id, useHdriLight: true })}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        envConfig.preset === p.id && envConfig.useHdriLight
                          ? 'bg-[#323232] text-white border border-white/20'
                          : 'bg-[#252525] text-[#b0b0b0] hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={onUploadHdrClick}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      envConfig.preset === 'custom'
                        ? 'bg-[#3b82f6] text-white'
                        : 'bg-[#2a2a2a] text-[#e5e5e5] hover:bg-[#343434] border border-white/10'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[115px]">
                      {envConfig.customFileName || 'Upload .HDR/.EXR'}
                    </span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3.5">
                  <label className="flex items-center gap-2 text-[#bdbdbd] whitespace-nowrap">
                    <span>HDRI Opacity</span>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      disabled={!envConfig.useHdriLight}
                      value={envConfig.hdriOpacity}
                      onChange={(e) =>
                        onUpdateEnv({ hdriOpacity: parseFloat(e.target.value) })
                      }
                      className="studio-slider w-20 sm:w-24"
                    />
                    <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-9 text-right">
                      {Math.round(envConfig.hdriOpacity * 100)}%
                    </span>
                  </label>

                  <label className="flex items-center gap-2 text-[#bdbdbd] whitespace-nowrap">
                    <span>Exposure</span>
                    <input
                      type="range"
                      min={0.2}
                      max={2.5}
                      step={0.05}
                      value={envConfig.exposure}
                      onChange={(e) =>
                        onUpdateEnv({ exposure: parseFloat(e.target.value) })
                      }
                      className="studio-slider w-16 sm:w-20"
                    />
                    <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-7 text-right">
                      {envConfig.exposure.toFixed(1)}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdateEnv({ showBackground: !envConfig.showBackground })
                    }
                    className={`px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      envConfig.showBackground
                        ? 'bg-[#323232] text-white border border-white/20'
                        : 'bg-[#1a1a1a] text-[#8e8e8e] hover:text-white'
                    }`}
                  >
                    {envConfig.showBackground ? 'Skybox: On' : 'Skybox: Off'}
                  </button>
                </div>
              </>
            )}

            {activeTab === 'postfx' && (
              <div className="w-full flex flex-col gap-2">
                {/* Row 1: Master Toggle, Sub-Section Switcher, One-Click Presets & Tone Mapping */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-white/[0.06]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdatePostProcessing({ enabled: !postProcessingConfig.enabled })
                      }
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        postProcessingConfig.enabled
                          ? 'bg-[#3b82f6] text-white'
                          : 'bg-[#2c2c2c] text-[#9e9e9e] hover:text-white'
                      }`}
                    >
                      {postProcessingConfig.enabled ? 'Post-FX: On' : 'Post-FX: Off'}
                    </button>

                    <div className="flex items-center bg-[#171717] p-0.5 rounded-md border border-white/10">
                      <button
                        type="button"
                        onClick={() => setPostFxSubSection('effects')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                          postFxSubSection === 'effects'
                            ? 'bg-[#323232] text-white'
                            : 'text-[#9e9e9e] hover:text-white'
                        }`}
                      >
                        Optics &amp; Bloom
                      </button>
                      <button
                        type="button"
                        onClick={() => setPostFxSubSection('colorbalance')}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                          postFxSubSection === 'colorbalance'
                            ? 'bg-[#323232] text-white'
                            : 'text-[#9e9e9e] hover:text-white'
                        }`}
                      >
                        Color Balance
                      </button>
                    </div>

                    <div className="flex items-center gap-1 ml-1">
                      <span className="text-[11px] text-[#8a8a8a] hidden sm:inline">Preset:</span>
                      {postPresets.map((pr) => (
                        <button
                          key={pr.id}
                          type="button"
                          onClick={() => onApplyPostPreset(pr.id)}
                          className="px-2 py-1 rounded bg-[#252525] hover:bg-[#323232] text-[#d4d4d4] hover:text-white text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          {pr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tone Mapping Mode Selector */}
                  <label className="flex items-center gap-1.5 text-[11px] text-[#bdbdbd] whitespace-nowrap shrink-0">
                    <span>Tone Map</span>
                    <select
                      value={postProcessingConfig.toneMapping}
                      onChange={(e) =>
                        onUpdatePostProcessing({
                          toneMapping: e.target.value as ToneMappingMode,
                        })
                      }
                      className="bg-[#171717] text-[#e5e5e5] border border-white/15 rounded-md px-2 py-1 text-[11px] outline-none cursor-pointer"
                    >
                      {toneMappingModes.map((tm) => (
                        <option key={tm.id} value={tm.id}>
                          {tm.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Row 2: Sub-section controls */}
                {postFxSubSection === 'effects' ? (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex flex-wrap items-center gap-3.5">
                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Brightness</span>
                        <input
                          type="range"
                          min={-0.5}
                          max={0.5}
                          step={0.01}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.brightness}
                          onChange={(e) =>
                            onUpdatePostProcessing({ brightness: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-8 text-right">
                          {postProcessingConfig.brightness >= 0 ? '+' : ''}
                          {Math.round(postProcessingConfig.brightness * 100)}%
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Contrast</span>
                        <input
                          type="range"
                          min={-0.5}
                          max={0.8}
                          step={0.02}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.contrast}
                          onChange={(e) =>
                            onUpdatePostProcessing({ contrast: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-8 text-right">
                          {postProcessingConfig.contrast >= 0 ? '+' : ''}
                          {Math.round(postProcessingConfig.contrast * 100)}%
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Sharpness</span>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.05}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.sharpness}
                          onChange={(e) =>
                            onUpdatePostProcessing({ sharpness: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-7 text-right">
                          {postProcessingConfig.sharpness.toFixed(2)}
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Chromatic</span>
                        <input
                          type="range"
                          min={0}
                          max={0.02}
                          step={0.0005}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.chromaticAberration}
                          onChange={(e) =>
                            onUpdatePostProcessing({
                              chromaticAberration: parseFloat(e.target.value),
                            })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-9 text-right">
                          {(postProcessingConfig.chromaticAberration * 1000).toFixed(1)}
                        </span>
                      </label>
                    </div>

                    {/* Bloom + Vignette controls */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={!postProcessingConfig.enabled}
                        onClick={() =>
                          onUpdatePostProcessing({
                            bloomEnabled: !postProcessingConfig.bloomEnabled,
                          })
                        }
                        className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          postProcessingConfig.bloomEnabled && postProcessingConfig.enabled
                            ? 'bg-[#3b82f6] text-white'
                            : 'bg-[#2a2a2a] text-[#9e9e9e] hover:text-white'
                        }`}
                      >
                        {postProcessingConfig.bloomEnabled ? 'Bloom: On' : 'Bloom: Off'}
                      </button>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Str</span>
                        <input
                          type="range"
                          min={0}
                          max={2.5}
                          step={0.05}
                          disabled={!postProcessingConfig.enabled || !postProcessingConfig.bloomEnabled}
                          value={postProcessingConfig.bloomStrength}
                          onChange={(e) =>
                            onUpdatePostProcessing({ bloomStrength: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-14"
                        />
                      </label>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Thresh</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.02}
                          disabled={!postProcessingConfig.enabled || !postProcessingConfig.bloomEnabled}
                          value={postProcessingConfig.bloomThreshold}
                          onChange={(e) =>
                            onUpdatePostProcessing({ bloomThreshold: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-14"
                        />
                      </label>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Rad</span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.02}
                          disabled={!postProcessingConfig.enabled || !postProcessingConfig.bloomEnabled}
                          value={postProcessingConfig.bloomRadius}
                          onChange={(e) =>
                            onUpdatePostProcessing({ bloomRadius: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-14"
                        />
                      </label>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Vignette</span>
                        <input
                          type="range"
                          min={0}
                          max={1.5}
                          step={0.05}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.vignetteIntensity}
                          onChange={(e) =>
                            onUpdatePostProcessing({
                              vignetteIntensity: parseFloat(e.target.value),
                            })
                          }
                          className="studio-slider w-14"
                        />
                      </label>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Vig Offset</span>
                        <input
                          type="range"
                          min={0.3}
                          max={1.5}
                          step={0.05}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.vignetteOffset}
                          onChange={(e) =>
                            onUpdatePostProcessing({
                              vignetteOffset: parseFloat(e.target.value),
                            })
                          }
                          className="studio-slider w-14"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex flex-wrap items-center gap-3.5">
                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Saturation</span>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.02}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.saturation}
                          onChange={(e) =>
                            onUpdatePostProcessing({ saturation: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-9 text-right">
                          {Math.round(postProcessingConfig.saturation * 100)}%
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Temp</span>
                        <input
                          type="range"
                          min={-1}
                          max={1}
                          step={0.02}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.temperature}
                          onChange={(e) =>
                            onUpdatePostProcessing({ temperature: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-8 text-right">
                          {postProcessingConfig.temperature.toFixed(2)}
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Tint</span>
                        <input
                          type="range"
                          min={-1}
                          max={1}
                          step={0.02}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.tint}
                          onChange={(e) =>
                            onUpdatePostProcessing({ tint: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-8 text-right">
                          {postProcessingConfig.tint.toFixed(2)}
                        </span>
                      </label>
                    </div>

                    {/* RGB Channel Multipliers */}
                    <div className="flex flex-wrap items-center gap-3.5">
                      <label className="flex items-center gap-1.5 text-red-300 whitespace-nowrap">
                        <span>Red</span>
                        <input
                          type="range"
                          min={0.5}
                          max={1.5}
                          step={0.01}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.balanceR}
                          onChange={(e) =>
                            onUpdatePostProcessing({
                              balanceR: parseFloat(e.target.value),
                            })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-8 text-right">
                          {Math.round(postProcessingConfig.balanceR * 100)}%
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 text-emerald-300 whitespace-nowrap">
                        <span>Green</span>
                        <input
                          type="range"
                          min={0.5}
                          max={1.5}
                          step={0.01}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.balanceG}
                          onChange={(e) =>
                            onUpdatePostProcessing({
                              balanceG: parseFloat(e.target.value),
                            })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-8 text-right">
                          {Math.round(postProcessingConfig.balanceG * 100)}%
                        </span>
                      </label>

                      <label className="flex items-center gap-1.5 text-sky-300 whitespace-nowrap">
                        <span>Blue</span>
                        <input
                          type="range"
                          min={0.5}
                          max={1.5}
                          step={0.01}
                          disabled={!postProcessingConfig.enabled}
                          value={postProcessingConfig.balanceB}
                          onChange={(e) =>
                            onUpdatePostProcessing({
                              balanceB: parseFloat(e.target.value),
                            })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-8 text-right">
                          {Math.round(postProcessingConfig.balanceB * 100)}%
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'colors' && (
              <div className="flex flex-wrap items-center justify-between w-full gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Viewport Background Color Picker */}
                  <label className="flex items-center gap-2 bg-[#171717] px-2.5 py-1 rounded-md border border-white/10 text-[#d4d4d4] cursor-pointer whitespace-nowrap shrink-0">
                    <span>Backdrop</span>
                    <input
                      type="color"
                      value={envConfig.backgroundColor}
                      onChange={(e) =>
                        onUpdateEnv({
                          backgroundColor: e.target.value,
                          showBackground: false,
                        })
                      }
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer"
                    />
                  </label>

                  {/* Ground Floor Color Picker */}
                  <label className="flex items-center gap-2 bg-[#171717] px-2.5 py-1 rounded-md border border-white/10 text-[#d4d4d4] cursor-pointer whitespace-nowrap shrink-0">
                    <span>Floor</span>
                    <input
                      type="color"
                      value={shadowConfig.floorColor}
                      onChange={(e) => onUpdateShadow({ floorColor: e.target.value })}
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer"
                    />
                  </label>

                  {/* Ground Grid Line Color Picker */}
                  <label className="flex items-center gap-2 bg-[#171717] px-2.5 py-1 rounded-md border border-white/10 text-[#d4d4d4] cursor-pointer whitespace-nowrap shrink-0">
                    <span>Grid Lines</span>
                    <input
                      type="color"
                      value={shadowConfig.gridColor}
                      onChange={(e) => onUpdateShadow({ gridColor: e.target.value })}
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer"
                    />
                  </label>

                  {/* Model Material Base Color Override */}
                  <div className="flex items-center gap-1.5 bg-[#171717] px-2.5 py-1 rounded-md border border-white/10 whitespace-nowrap shrink-0">
                    <label className="flex items-center gap-1.5 text-[#d4d4d4] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={materialColorConfig.overrideEnabled}
                        onChange={(e) =>
                          onUpdateMaterialColor({ overrideEnabled: e.target.checked })
                        }
                        className="accent-[#3b82f6]"
                      />
                      <span>Model Color</span>
                    </label>
                    <input
                      type="color"
                      value={materialColorConfig.baseColor}
                      onChange={(e) =>
                        onUpdateMaterialColor({
                          overrideEnabled: true,
                          baseColor: e.target.value,
                        })
                      }
                      className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer"
                    />
                    {materialColorConfig.overrideEnabled && (
                      <button
                        type="button"
                        onClick={() => onUpdateMaterialColor({ overrideEnabled: false })}
                        className="text-[11px] text-[#9e9e9e] hover:text-white ml-1 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Upload / Apply Texture Image directly */}
                <button
                  type="button"
                  onClick={onUploadTextureClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2a2a2a] hover:bg-[#343434] text-[#e5e5e5] border border-white/10 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {materialColorConfig.customTextureName
                      ? `Tex: ${materialColorConfig.customTextureName}`
                      : 'Apply Texture (.PNG/.JPG)'}
                  </span>
                </button>
              </div>
            )}

            {activeTab === 'shading' && (
              <div className="flex flex-wrap items-center justify-between w-full gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {inspectionOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectInspectionMode(item.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        inspectionMode === item.id
                          ? 'bg-[#3b82f6] text-white'
                          : 'bg-[#2a2a2a] text-[#b0b0b0] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <span className="text-[11px] text-[#8a8a8a] hidden sm:inline">
                  Non-destructive channel diagnostic override
                </span>
              </div>
            )}

            {activeTab === 'animation' && (
              <div className="flex flex-wrap items-center justify-between w-full gap-3">
                {hasAnimations ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Play / Pause */}
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateAnimation({ isPlaying: !animationState.isPlaying })
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {animationState.isPlaying ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>Play</span>
                          </>
                        )}
                      </button>

                      {/* Reset to 0.00s */}
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateAnimation({ currentTime: 0, seekTime: 0 })
                        }
                        className="px-2 py-1.5 rounded-md bg-[#2a2a2a] hover:bg-[#343434] text-[#d4d4d4] text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
                        title="Rewind to start"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* Clip Selector (+ Play All Clips Simultaneously) */}
                      <select
                        value={animationState.activeClip || modelMetadata!.animations[0]}
                        onChange={(e) =>
                          onUpdateAnimation({
                            activeClip: e.target.value,
                            currentTime: 0,
                            seekTime: 0,
                          })
                        }
                        className="bg-[#171717] text-[#e5e5e5] border border-white/15 rounded-md px-2 py-1 text-xs outline-none cursor-pointer max-w-[180px]"
                        aria-label="Select Animation Clip"
                      >
                        {modelMetadata!.animations.length > 1 && (
                          <option value="__ALL__">All Clips (Simultaneous)</option>
                        )}
                        {modelMetadata!.animations.map((clip) => (
                          <option key={clip} value={clip}>
                            {clip}
                          </option>
                        ))}
                      </select>

                      {/* Timeline Scrubber */}
                      <label className="flex items-center gap-2 text-[#bdbdbd] whitespace-nowrap">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0.01, animationState.duration)}
                          step={0.01}
                          value={Math.min(animationState.currentTime, animationState.duration || 1)}
                          onChange={(e) => {
                            const t = parseFloat(e.target.value);
                            onUpdateAnimation({ currentTime: t, seekTime: t });
                          }}
                          className="studio-slider w-24 sm:w-36"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-[78px] text-right">
                          {animationState.currentTime.toFixed(1)}s /{' '}
                          {animationState.duration.toFixed(1)}s
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Speed Slider */}
                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Speed</span>
                        <input
                          type="range"
                          min={0.1}
                          max={3.0}
                          step={0.1}
                          value={animationState.speed}
                          onChange={(e) =>
                            onUpdateAnimation({ speed: parseFloat(e.target.value) })
                          }
                          className="studio-slider w-16"
                        />
                        <span className="font-mono-tabular text-[11px] text-[#9e9e9e] w-8 text-right">
                          {animationState.speed.toFixed(1)}x
                        </span>
                      </label>

                      {/* Loop Mode Selector */}
                      <label className="flex items-center gap-1.5 text-[#bdbdbd] whitespace-nowrap">
                        <span>Loop</span>
                        <select
                          value={animationState.loopMode}
                          onChange={(e) =>
                            onUpdateAnimation({
                              loopMode: e.target.value as AnimationLoopMode,
                            })
                          }
                          className="bg-[#171717] text-[#e5e5e5] border border-white/15 rounded-md px-2 py-1 text-[11px] outline-none cursor-pointer"
                        >
                          <option value="repeat">Repeat</option>
                          <option value="once">Play Once</option>
                          <option value="pingpong">Ping-Pong</option>
                        </select>
                      </label>

                      {/* Skeleton Bone Helper Toggle */}
                      {hasSkeleton && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateAnimation({
                              showSkeleton: !animationState.showSkeleton,
                            })
                          }
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            animationState.showSkeleton
                              ? 'bg-[#3b82f6] text-white'
                              : 'bg-[#2a2a2a] text-[#b5b5b5] hover:text-white'
                          }`}
                        >
                          <Bone className="w-3.5 h-3.5" />
                          <span>
                            {animationState.showSkeleton ? 'Skeleton: On' : 'Skeleton: Off'}
                          </span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-between w-full gap-3">
                    <span className="text-xs text-[#9e9e9e]">
                      No keyframe animation clips found in this {modelMetadata?.format.toUpperCase()}{' '}
                      model. Upload an animated <code className="text-white">.glb</code>,{' '}
                      <code className="text-white">.gltf</code>,{' '}
                      <code className="text-white">.fbx</code>, or{' '}
                      <code className="text-white">.dae</code> file, or load the animated sample in
                      Guide.
                    </span>
                    {hasSkeleton && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateAnimation({
                            showSkeleton: !animationState.showSkeleton,
                          })
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          animationState.showSkeleton
                            ? 'bg-[#3b82f6] text-white'
                            : 'bg-[#2a2a2a] text-[#b5b5b5] hover:text-white'
                        }`}
                      >
                        <Bone className="w-3.5 h-3.5" />
                        <span>
                          {animationState.showSkeleton ? 'Skeleton: On' : 'Skeleton: Off'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'camera' && (
              <div className="flex flex-wrap items-center justify-between w-full gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateCamera({ autoRotate: !cameraConfig.autoRotate })
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      cameraConfig.autoRotate
                        ? 'bg-[#3b82f6] text-white'
                        : 'bg-[#2a2a2a] text-[#e5e5e5] hover:bg-[#343434]'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{cameraConfig.autoRotate ? 'Auto-Rotate: On' : 'Auto-Rotate: Off'}</span>
                  </button>

                  {cameraConfig.autoRotate && (
                    <label className="flex items-center gap-2 text-[#bdbdbd] px-2 whitespace-nowrap">
                      <span>Speed</span>
                      <input
                        type="range"
                        min={0.4}
                        max={6.0}
                        step={0.2}
                        value={cameraConfig.autoRotateSpeed}
                        onChange={(e) =>
                          onUpdateCamera({ autoRotateSpeed: parseFloat(e.target.value) })
                        }
                        className="studio-slider w-16 sm:w-20"
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={() => onTriggerCameraPreset('reset')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#2a2a2a] text-[#e5e5e5] hover:bg-[#343434] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onTriggerCameraPreset('isometric')}
                    className="px-2.5 py-1.5 rounded-md bg-[#2a2a2a] text-[#b5b5b5] hover:text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Isometric
                  </button>
                  <button
                    type="button"
                    onClick={() => onTriggerCameraPreset('front')}
                    className="px-2.5 py-1.5 rounded-md bg-[#2a2a2a] text-[#b5b5b5] hover:text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    onClick={() => onTriggerCameraPreset('top')}
                    className="px-2.5 py-1.5 rounded-md bg-[#2a2a2a] text-[#b5b5b5] hover:text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Top
                  </button>
                </div>

                {hasSkeleton && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateAnimation({
                        showSkeleton: !animationState.showSkeleton,
                      })
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      animationState.showSkeleton
                        ? 'bg-[#3b82f6] text-white'
                        : 'bg-[#2a2a2a] text-[#b5b5b5] hover:text-white'
                    }`}
                  >
                    <Bone className="w-3.5 h-3.5" />
                    <span>
                      {animationState.showSkeleton ? 'Skeleton: On' : 'Skeleton: Off'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
