import React from 'react';
import { Upload, AlertCircle } from 'lucide-react';

interface DropzoneOverlayProps {
  isDragging: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  onChooseFileClick: () => void;
  onChooseFolderClick: () => void;
  onDismissError: () => void;
}

export const DropzoneOverlay: React.FC<DropzoneOverlayProps> = ({
  isDragging,
  isLoading,
  errorMessage,
  onChooseFileClick,
  onChooseFolderClick,
  onDismissError,
}) => {
  return (
    <main
      className="fixed inset-x-0 top-[52px] bottom-[30px] z-10 flex flex-col items-center justify-center px-4 bg-[#191919]"
      aria-label="glTF 2.0 File Dropzone"
    >
      {/* Centered Dropzone Box matching reference screenshot */}
      <div
        onClick={onChooseFileClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChooseFileClick();
          }
        }}
        className={`w-full max-w-[475px] h-[180px] sm:h-[215px] rounded-[8px] bg-[#252525] flex flex-col items-center justify-center px-6 text-center cursor-pointer transition-transform duration-150 ${
          isDragging
            ? 'border-2 border-[#3b82f6] scale-[1.015] bg-[#2a2a2a]'
            : 'border border-white/[0.04] hover:bg-[#292929]'
        }`}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <span className="text-[19px] sm:text-[22px] font-normal text-[#bdbdbd] tracking-tight">
              Parsing 3D scene...
            </span>
            <span className="text-xs text-[#8a8a8a]">
              Preparing WebGL buffers, ground shadow &amp; PBR environment
            </span>
          </div>
        ) : (
          <span className="text-[18px] sm:text-[23px] font-normal text-[#9e9e9e] tracking-[-0.01em] select-none">
            Drag glTF 2.0 file or folder here
          </span>
        )}
      </div>

      {/* Choose file / folder triggers underneath matching reference screenshot */}
      <div className="mt-8 sm:mt-10 flex items-center gap-4">
        <button
          type="button"
          onClick={onChooseFileClick}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 text-[15px] sm:text-[17px] font-normal text-[#9e9e9e] hover:text-[#e5e5e5] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#3b82f6] rounded-md whitespace-nowrap shrink-0"
        >
          <Upload className="w-[18px] h-[18px] stroke-[2.2]" />
          <span>Choose file</span>
        </button>
        <span className="text-[#4a4a4a]" aria-hidden="true">·</span>
        <button
          type="button"
          onClick={onChooseFolderClick}
          className="inline-flex items-center gap-2 px-3 py-2.5 text-[14px] sm:text-[15px] font-normal text-[#7e7e7e] hover:text-[#e5e5e5] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#3b82f6] rounded-md whitespace-nowrap shrink-0"
        >
          <span>Choose folder</span>
        </button>
      </div>

      {/* Inline error notification if an invalid file was dropped */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-6 max-w-[475px] w-full bg-[#2a1f1f] border border-red-500/30 rounded-lg px-4 py-3 flex items-start justify-between gap-3 text-xs text-red-200"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="text-red-300 hover:text-white font-medium shrink-0 cursor-pointer px-1"
          >
            Dismiss
          </button>
        </div>
      )}
    </main>
  );
};
