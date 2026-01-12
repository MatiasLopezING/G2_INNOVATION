import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { cn } from '../lib/utils';

function isAcceptedImage(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  const name = String(file.name || '').toLowerCase();
  return (
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

export function FileDropzone({
  id,
  title,
  subtitle = 'PNG, JPG hasta 5MB',
  value,
  onChange,
  maxSizeBytes = 5 * 1024 * 1024,
  error,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    };
  }, [value]);

  const pickFile = () => inputRef.current?.click();

  const validateAndSet = useCallback(
    (file) => {
      if (!file) return;
      if (!isAcceptedImage(file)) {
        onChange?.(null, 'Lo que estás cargando no parece una foto (JPG/PNG/WEBP/HEIC).');
        return;
      }
      if (file.size > maxSizeBytes) {
        onChange?.(null, 'La imagen es demasiado pesada (máx 5MB).');
        return;
      }
      onChange?.(file, '');
    },
    [maxSizeBytes, onChange]
  );

  const onInputChange = (e) => {
    const file = e.target.files && e.target.files[0];
    validateAndSet(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    validateAndSet(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const remove = () => {
    onChange?.(null, '');
  };

  const stateClass = useMemo(() => {
    if (error) return 'border-red-300 bg-red-50/30';
    if (isDragging) return 'border-teal-400 bg-teal-50/40';
    return 'border-slate-300 bg-white';
  }, [error, isDragging]);

  return (
    <div className="space-y-2">
      {title ? <div className="text-sm font-medium text-slate-700">{title}</div> : null}

      <div
        role="button"
        tabIndex={0}
        onClick={pickFile}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') pickFile();
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          'rounded-xl border-2 border-dashed p-6 transition cursor-pointer',
          'hover:bg-slate-50',
          stateClass
        )}
        aria-label={title ? `Subir archivo: ${title}` : 'Subir archivo'}
      >
        {!value ? (
          <div className="flex flex-col items-center justify-center text-center">
            <CloudUploadOutlinedIcon className="text-slate-400" fontSize="large" />
            <p className="mt-3 text-sm font-medium text-slate-700">
              <span className="text-teal-600">Haz clic para subir</span> o arrastra la foto aquí
            </p>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-md border border-slate-200 bg-white">
                {previewUrl ? (
                  <img src={previewUrl} alt="Vista previa" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Archivo cargado</div>
                <div className="text-xs text-slate-500 truncate max-w-[180px]">{value.name}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove();
              }}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <DeleteOutlineIcon fontSize="small" />
              Quitar
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*"
          onChange={onInputChange}
          className="hidden"
        />
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
