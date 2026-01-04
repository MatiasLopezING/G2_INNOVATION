import React from 'react';
import { cn } from '../../lib/utils';

function Spinner({ className }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent',
        className
      )}
      aria-hidden="true"
    />
  );
}

export { Spinner };
