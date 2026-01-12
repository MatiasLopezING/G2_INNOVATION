import React from 'react';
import { cn } from '../../lib/utils';

function Badge({ className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700',
        className
      )}
      {...props}
    />
  );
}

export { Badge };
