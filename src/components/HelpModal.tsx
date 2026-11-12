import React, { useState } from 'react';
import { X, Download, Box, Sun, Smartphone } from 'lucide-react';
import { generateSampleGlbBuffer } from '../utils/fileIngest';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadGeneratedSample: (file: File) => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  onLoadGeneratedSample,
}) => {
  const [generating, setGenerating] = useState(false);

  if (!isOpen) return null;

  const handleDownloadSampleGlb = async () => {
    try {
      setGenerating(true);
      const buffer = await generateSampleGlbBuffer();
      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kmod-gyro-chronometer.glb';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenSampleInViewer = async () => {
    try {
      setGenerating(true);
      const buffer = await generateSampleGlbBuffer();
      const file = new File([buffer], 'kmod-gyro-chronometer.glb', {
        type: 'model/gltf-binary',
      });
      onLoadGeneratedSample(file);
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="w-full max-w-[540px] bg-[#242424] border border-white/10 rounded-xl p-6 text-[#e5e5e5] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <h2 id="help-modal-title" className="text-base font-semibold font-display">
            KMod viewer — Help &amp; Studio Guide
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#9e9e9e] hover:text-white rounded-md cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs text-[#bdbdbd] leading-relaxed">
          <div className="flex items-start gap-3">
            <Box className="w-4 h-4 text-[#3b82f6] shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-white">Local glTF 2.0, Folders &amp; Live Texture Drops</p>
              <p className="mt-0.5">
                Drag and drop a single <code className="text-white">.glb</code> file or an entire
                folder containing a <code className="text-white">.gltf</code> file,{' '}
                <code className="text-white">.bin</code> buffer, and{' '}
                <code className="text-white">textures/</code> folder. You can also drop any{' '}
                <code className="text-white">.png</code> or <code className="text-white">.jpg</code>{' '}
                texture directly onto a loaded model to apply it immediately.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Sun className="w-4 h-4 text-[#3b82f6] shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-white">Ground Grid, Shadows &amp; HDRI Controls</p>
              <p className="mt-0.5">
                Models are grounded at <code className="text-white">Y = 0</code> over a customizable
                studio ground grid and soft radial shadow. Toggle HDRI lighting on/off, adjust HDRI
                opacity, customize backdrop/grid/model colors, or enable camera auto-rotation.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Smartphone className="w-4 h-4 text-[#3b82f6] shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-white">Offline HTML Export with Minimizable Controls</p>
              <p className="mt-0.5">
                Click <code className="text-white">Export Offline HTML</code> to download a
                standalone single-file viewer with your loaded model, textures, ground grid,
                auto-rotation, and collapsible control bar embedded.
              </p>
            </div>
          </div>
        </div>

        {/* Sample GLB Generator for quick testing */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <span className="text-xs text-[#9e9e9e]">
            Need a textured <code className="text-[#e5e5e5]">.glb</code> model to test?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={generating}
              onClick={handleDownloadSampleGlb}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#303030] hover:bg-[#3a3a3a] text-xs font-medium text-[#e5e5e5] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .GLB</span>
            </button>
            <button
              type="button"
              disabled={generating}
              onClick={handleOpenSampleInViewer}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Load Sample .GLB</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
