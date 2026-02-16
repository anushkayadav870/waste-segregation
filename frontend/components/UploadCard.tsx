'use client';

import { useCallback, useRef, useState } from 'react';

type UploadCardProps = {
  onAnalyze: (file: File) => Promise<void>;
  loading: boolean;
};

export default function UploadCard({ onAnalyze, loading }: UploadCardProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }, []);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  }, [handleFile]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <h2 className="text-xl font-semibold text-ink">1. Upload Waste Image</h2>
      <p className="mt-2 text-sm text-slate-600">Drag and drop or choose a JPG, PNG, or WEBP image.</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragActive ? 'border-sky bg-sky-50' : 'border-mist bg-slate-50'
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <p className="text-sm font-medium text-slate-700">Drop image here or click to browse</p>
        <p className="mt-1 text-xs text-slate-500">Max file size: 10MB</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileChange}
      />

      {previewUrl && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <img src={previewUrl} alt="Preview" className="h-64 w-full object-contain" />
        </div>
      )}

      <button
        className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-ink px-4 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        onClick={() => selectedFile && onAnalyze(selectedFile)}
        disabled={!selectedFile || loading}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Analyzing...
          </span>
        ) : (
          'Analyze Image'
        )}
      </button>
    </div>
  );
}
