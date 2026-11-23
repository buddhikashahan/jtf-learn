"use client";

import { useId, useRef, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { UPLOAD_LIMITS, validateFile, type UploadKind } from "@/lib/validation";

/** Drag-and-drop file picker with client-side type/size validation. */
export function FileDropzone({
  kind,
  file,
  onFileChange,
  progress,
  disabled,
  hint,
}: {
  kind: UploadKind;
  file: File | null;
  onFileChange: (file: File | null) => void;
  progress?: number | null;
  disabled?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = UPLOAD_LIMITS[kind];

  function accept(f: File | undefined) {
    if (!f) return;
    const problem = validateFile(f, kind);
    setError(problem);
    onFileChange(problem ? null : f);
  }

  if (file) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-surface text-brand-600 ring-1 ring-slate-200">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-surface hover:text-slate-600"
              aria-label="Remove file"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {progress != null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-label="Upload progress">
            <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
          dragging ? "border-brand-400 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/60",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <UploadCloud className="size-8 text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-700">
          <span className="text-brand-600">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {hint ?? `Max ${Math.round(limit.maxBytes / 1024 / 1024)} MB`}
        </p>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="sr-only"
          accept={limit.types.join(",")}
          disabled={disabled}
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
