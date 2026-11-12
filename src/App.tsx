import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ThreeViewport } from './components/ThreeViewport';
import { DropzoneOverlay } from './components/DropzoneOverlay';
import { BottomControlDock } from './components/BottomControlDock';
import { HelpModal } from './components/HelpModal';
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
  PostProcessingPreset,
  ShadowConfig,
} from './types/viewer';
import {
  extractFilesFromDataTransfer,
  extractFilesFromFileList,
  processUploadedFileMap,
} from './utils/fileIngest';
import { downloadStandaloneOfflineHtml } from './utils/offlineHtmlExporter';
import {
  DEFAULT_POST_PROCESSING_CONFIG,
  getPostProcessingPreset,
} from './utils/postProcessingShader';

export default function App() {
  // Primary asset & metadata state (starts strictly at empty dropzone until a local file is uploaded)
  const [gltfAsset, setGltfAsset] = useState<LoadedGltfAsset | null>(null);
  const [modelMetadata, setModelMetadata] = useState<ModelMetadata | null>(null);
  const [packedGlbBuffer, setPackedGlbBuffer] = useState<ArrayBuffer | null>(null);
  const [customEnvFile, setCustomEnvFile] = useState<File | null>(null);
  const [customTextureFiles, setCustomTextureFiles] = useState<File[] | null>(null);

  // Drag, loading & error state
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Ground contact shadow + ground grid texture configuration
  const [shadowConfig, setShadowConfig] = useState<ShadowConfig>({
    enabled: true,
    opacity: 0.65,
    blur: 1.4,
    directionalShadow: true,
    gridMode: 'all',
    floorColor: '#22252a',
    gridColor: '#525b6c',
  });

  // HDRI & lighting configuration (with HDRI Light toggle and HDRI Opacity slider)
  const [envConfig, setEnvConfig] = useState<EnvironmentConfig>({
    useHdriLight: true,
    hdriOpacity: 1.0,
    preset: 'studio',
    customFileName: null,
    exposure: 1.05,
    envIntensity: 1.0,
    showBackground: false,
    backgroundBlurriness: 0.15,
    backgroundColor: '#191919',
  });

  // Camera auto-rotation configuration
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>({
    autoRotate: false,
    autoRotateSpeed: 2.0,
  });

  // Custom model material color & texture configuration
  const [materialColorConfig, setMaterialColorConfig] = useState<MaterialColorConfig>({
    overrideEnabled: false,
    baseColor: '#3b82f6',
    customTextureName: null,
  });

  // Post-processing filter suite configuration
  const [postProcessingConfig, setPostProcessingConfig] = useState<PostProcessingConfig>(
    DEFAULT_POST_PROCESSING_CONFIG
  );

  // Material channel diagnostic mode
  const [inspectionMode, setInspectionMode] = useState<InspectionMode>('pbr');

  // Smooth damped camera preset trigger
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<{
    preset: CameraPreset;
    timestamp: number;
  } | null>(null);

  // Animation & Rigging Studio state
  const [animationState, setAnimationState] = useState<AnimationState>({
    activeClip: null,
    isPlaying: true,
    speed: 1.0,
    loopMode: 'repeat',
    showSkeleton: false,
    currentTime: 0,
    duration: 0,
    seekTime: null,
  });

  // Collapsible bottom studio dock
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Hidden file inputs for 3D models, folders, custom textures, and custom HDR/EXR uploads
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const textureInputRef = useRef<HTMLInputElement | null>(null);
  const hdrInputRef = useRef<HTMLInputElement | null>(null);

  const handleIngestFileMap = useCallback(async (fileMap: Map<string, File>) => {
    if (fileMap.size === 0) return;
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await processUploadedFileMap(fileMap);
      if (result.error) {
        setIsLoading(false);
        setErrorMessage(result.error);
        return;
      }

      if (result.environmentFile) {
        setCustomEnvFile(result.environmentFile);
        setEnvConfig((prev) => ({
          ...prev,
          useHdriLight: true,
          preset: 'custom',
          customFileName: result.environmentFile!.name,
        }));
      }

      if (result.textureFiles && result.textureFiles.length > 0) {
        setCustomTextureFiles(result.textureFiles);
        setMaterialColorConfig((prev) => ({
          ...prev,
          overrideEnabled: false,
          customTextureName: result.textureFiles![0].name,
        }));
        setIsLoading(false);
      }

      if (result.gltfAsset) {
        setPackedGlbBuffer(result.gltfAsset.rawGlbBuffer);
        setGltfAsset((prev) => {
          if (prev) {
            prev.resourceMap.forEach((url) => URL.revokeObjectURL(url));
          }
          return result.gltfAsset!;
        });
        setMaterialColorConfig((prev) => ({
          ...prev,
          overrideEnabled: false,
          customTextureName: null,
        }));
        setInspectionMode('pbr');
      } else if (!result.environmentFile && !result.textureFiles) {
        setIsLoading(false);
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to read dropped files.'
      );
    }
  }, []);

  // Global drag-and-drop listeners across the entire viewport
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!e.dataTransfer) return;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const fileMap = await extractFilesFromDataTransfer(e.dataTransfer.items);
        await handleIngestFileMap(fileMap);
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const fileMap = extractFilesFromFileList(e.dataTransfer.files);
        await handleIngestFileMap(fileMap);
      }
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleIngestFileMap]);

  // Keyboard shortcut 'H' to collapse/expand bottom control dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'h' && modelMetadata) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modelMetadata]);

  const handleChooseFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleChooseFolderClick = () => {
    folderInputRef.current?.click();
  };

  const handleUploadTextureClick = () => {
    textureInputRef.current?.click();
  };

  const handleUploadHdrClick = () => {
    hdrInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileMap = extractFilesFromFileList(e.target.files);
      await handleIngestFileMap(fileMap);
      e.target.value = '';
    }
  };

  const handleTextureInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setCustomTextureFiles(files);
      setMaterialColorConfig((prev) => ({
        ...prev,
        overrideEnabled: false,
        customTextureName: files[0].name,
      }));
      e.target.value = '';
    }
  };

  const handleHdrInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomEnvFile(file);
    setEnvConfig((prev) => ({
      ...prev,
      useHdriLight: true,
      preset: 'custom',
      customFileName: file.name,
    }));
    e.target.value = '';
  };

  const handleClearScene = () => {
    if (gltfAsset) {
      gltfAsset.resourceMap.forEach((url) => URL.revokeObjectURL(url));
    }
    setGltfAsset(null);
    setModelMetadata(null);
    setPackedGlbBuffer(null);
    setErrorMessage(null);
  };

  const handleExportOfflineHtml = () => {
    downloadStandaloneOfflineHtml(
      shadowConfig,
      envConfig,
      cameraConfig,
      materialColorConfig,
      postProcessingConfig,
      animationState,
      modelMetadata?.fileName || null,
      packedGlbBuffer || gltfAsset?.rawGlbBuffer || null
    );
  };

  const handleApplyPostPreset = (preset: PostProcessingPreset) => {
    setPostProcessingConfig(getPostProcessingPreset(preset));
  };

  const hasModel = Boolean(gltfAsset && modelMetadata);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#191919] select-none">
      {/* Top Bar following the 3-Zone Contract & KMod viewer Brand Mark */}
      <header className="fixed top-0 inset-x-0 h-[52px] bg-[#353535] border-b border-white/[0.06] px-5 sm:px-7 flex items-center justify-between gap-8 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            if (hasModel) handleClearScene();
          }}
          className="text-[20px] sm:text-[22px] font-medium tracking-[-0.01em] text-[#f0f0f0] hover:text-white transition-colors whitespace-nowrap shrink-0 font-display"
        >
          KMod viewer
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#c4c4c4]">
          <button
            type="button"
            onClick={handleChooseFileClick}
            className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Open 3D Model
          </button>
          <button
            type="button"
            onClick={handleUploadHdrClick}
            className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Load HDRI
          </button>
          <button
            type="button"
            onClick={() =>
              setCameraConfig((prev) => ({ ...prev, autoRotate: !prev.autoRotate }))
            }
            className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {cameraConfig.autoRotate ? 'Auto-Rotate: On' : 'Auto-Rotate: Off'}
          </button>
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="hover:text-white hover:underline underline-offset-4 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Guide
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleExportOfflineHtml}
            className="px-3.5 py-1.5 text-xs font-medium text-[#e5e5e5] bg-[#242424] hover:bg-[#1c1c1c] border border-white/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Export Offline HTML
          </button>
        </div>
      </header>

      {/* Isolated WebGL 3D Viewport Container */}
      <ThreeViewport
        gltfAsset={gltfAsset}
        customEnvironmentFile={customEnvFile}
        customTextureFiles={customTextureFiles}
        shadowConfig={shadowConfig}
        envConfig={envConfig}
        cameraConfig={cameraConfig}
        materialColorConfig={materialColorConfig}
        postProcessingConfig={postProcessingConfig}
        inspectionMode={inspectionMode}
        cameraPresetTrigger={cameraPresetTrigger}
        animationState={animationState}
        onAnimationTimeUpdate={(currentTime, duration) => {
          setAnimationState((prev) => ({
            ...prev,
            currentTime,
            duration,
            seekTime: null,
          }));
        }}
        onModelLoaded={(meta) => {
          setModelMetadata(meta);
          setAnimationState((prev) => ({
            ...prev,
            activeClip: meta.animations[0] || null,
            isPlaying: meta.animations.length > 0,
            currentTime: 0,
            seekTime: null,
          }));
        }}
        onPackedGlbReady={setPackedGlbBuffer}
        onLoadError={(msg) => {
          setErrorMessage(msg);
          setGltfAsset(null);
          setModelMetadata(null);
        }}
        onLoadingChange={setIsLoading}
      />

      {/* Strict Empty Dropzone Landing (Shown until a local 3D model is uploaded) */}
      {!hasModel && (
        <DropzoneOverlay
          isDragging={isDragging}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onChooseFileClick={handleChooseFileClick}
          onChooseFolderClick={handleChooseFolderClick}
          onDismissError={() => setErrorMessage(null)}
        />
      )}

      {/* Drag-over highlight border when a model is already open */}
      {hasModel && isDragging && (
        <div className="fixed inset-0 top-[52px] bottom-[30px] z-25 pointer-events-none border-2 border-[#3b82f6] bg-black/30 flex items-center justify-center">
          <div className="bg-[#252525] border border-white/15 px-6 py-4 rounded-xl text-sm text-white shadow-2xl">
            Drop new <code className="text-[#3b82f6]">.glb / .usdz / .fbx / .obj / .stl / .ply / .dae / .3mf</code>{' '}
            model, <code className="text-[#3b82f6]">.png / .jpg</code> texture, or{' '}
            <code className="text-[#3b82f6]">.hdr / .exr</code> HDRI
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Shown once model is loaded) */}
      {hasModel && (
        <BottomControlDock
          dockCollapsed={dockCollapsed}
          onToggleCollapse={() => setDockCollapsed((prev) => !prev)}
          shadowConfig={shadowConfig}
          onUpdateShadow={(patch) =>
            setShadowConfig((prev) => ({ ...prev, ...patch }))
          }
          envConfig={envConfig}
          onUpdateEnv={(patch) => setEnvConfig((prev) => ({ ...prev, ...patch }))}
          cameraConfig={cameraConfig}
          onUpdateCamera={(patch) =>
            setCameraConfig((prev) => ({ ...prev, ...patch }))
          }
          materialColorConfig={materialColorConfig}
          onUpdateMaterialColor={(patch) =>
            setMaterialColorConfig((prev) => ({ ...prev, ...patch }))
          }
          postProcessingConfig={postProcessingConfig}
          onUpdatePostProcessing={(patch) =>
            setPostProcessingConfig((prev) => ({ ...prev, ...patch }))
          }
          onApplyPostPreset={handleApplyPostPreset}
          onUploadHdrClick={handleUploadHdrClick}
          onUploadTextureClick={handleUploadTextureClick}
          inspectionMode={inspectionMode}
          onSelectInspectionMode={setInspectionMode}
          onTriggerCameraPreset={(preset) =>
            setCameraPresetTrigger({ preset, timestamp: Date.now() })
          }
          modelMetadata={modelMetadata}
          animationState={animationState}
          onUpdateAnimation={(patch) =>
            setAnimationState((prev) => ({ ...prev, ...patch }))
          }
        />
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".gltf,.glb,.usdz,.usda,.fbx,.obj,.mtl,.stl,.ply,.dae,.3mf,.bin,.png,.jpg,.jpeg,.webp,.hdr,.exr"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={textureInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        onChange={handleTextureInputChange}
        className="hidden"
      />
      <input
        ref={hdrInputRef}
        type="file"
        accept=".hdr,.exr"
        onChange={handleHdrInputChange}
        className="hidden"
      />

      {/* Quiet Bottom Status / Footer Bar */}
      <footer className="fixed bottom-0 inset-x-0 h-[30px] bg-[#191919] px-4 flex items-center justify-between text-[12px] text-[#8c8c8c] font-mono-tabular z-30">
        <div className="flex items-center gap-2 truncate">
          {hasModel && modelMetadata ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleChooseFileClick}
                className="hover:text-[#d4d4d4] transition-colors cursor-pointer truncate"
              >
                Load another file
              </button>
              {modelMetadata.missingTextures.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={handleUploadTextureClick}
                    className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer truncate"
                  >
                    + Apply missing texture ({modelMetadata.missingTextures.length})
                  </button>
                </>
              )}
            </div>
          ) : (
            <span className="hidden sm:inline text-[#6e6e6e]">
              KMod viewer · glb · usdz · fbx · obj · stl · ply · dae · 3mf · animations · post-fx
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0 ml-auto">
          <span>three.js r176</span>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="hover:text-[#d4d4d4] transition-colors cursor-pointer"
          >
            help &amp; feedback
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={handleExportOfflineHtml}
            className="hover:text-[#d4d4d4] transition-colors cursor-pointer"
          >
            offline html
          </button>
        </div>
      </footer>

      {/* Help & Sample GLB Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onLoadGeneratedSample={(file) => {
          const map = new Map<string, File>([[file.name, file]]);
          handleIngestFileMap(map);
        }}
      />
    </div>
  );
}
