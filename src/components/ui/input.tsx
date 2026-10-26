import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-100 shadow-2xs transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:border-indigo-500 focus-visible:ring-1 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Input };
