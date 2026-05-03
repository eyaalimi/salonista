"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
}

export function ImageUpload({ images, onChange, max = 5 }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList) {
    const remaining = max - images.length;
    if (remaining <= 0) {
      setError(`Maximum ${max} images`);
      return;
    }

    const files = Array.from(fileList).slice(0, remaining);
    setUploading(true);
    setError("");

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur d'upload");
        return;
      }

      onChange([...images, ...data.urls]);
    } catch {
      setError("Erreur réseau");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  return (
    <div>
      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          {images.map((url, i) => (
            <div key={url} className="relative aspect-square group">
              <Image
                src={url}
                alt={`Photo ${i + 1}`}
                fill
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {images.length < max && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-brand-gold/30 hover:border-brand-gold p-6 text-center cursor-pointer transition-colors duration-300"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          {uploading ? (
            <p className="text-xs tracking-[0.15em] uppercase text-brand-bordeaux/50">Upload en cours...</p>
          ) : (
            <>
              <svg className="w-8 h-8 mx-auto mb-2 text-brand-gold/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs tracking-[0.15em] uppercase text-brand-bordeaux/40">
                Glissez vos images ici ou cliquez
              </p>
              <p className="text-[10px] text-brand-bordeaux/25 mt-1">JPG, PNG, WebP — max 5 Mo</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
