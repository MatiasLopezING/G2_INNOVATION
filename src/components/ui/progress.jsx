import React from 'react';
import { cn } from '../../lib/utils';

function Progress({ value = 0, className }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}>
      <div
        className="h-full bg-teal-600 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
