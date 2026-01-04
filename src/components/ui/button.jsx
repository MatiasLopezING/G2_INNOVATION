import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  default: 'bg-teal-600 text-white hover:bg-teal-700',
  outline: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
};

const sizes = {
  default: 'h-10 px-4 py-2',
  lg: 'h-11 px-6',
  sm: 'h-9 px-3',
};

const Button = React.forwardRef(function Button(
  { className, variant = 'default', size = 'default', type, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});

export { Button };
