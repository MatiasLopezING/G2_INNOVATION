import React from 'react';
import { cn } from '../../lib/utils';

function Alert({ className, variant = 'default', ...props }) {
  return (
    <div
      className={cn(
        'w-full rounded-md border px-4 py-3 text-sm',
        variant === 'error' && 'border-red-200 bg-red-50 text-red-700',
        variant === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        variant === 'default' && 'border-slate-200 bg-white text-slate-700',
        className
      )}
      {...props}
    />
  );
}

export { Alert };
