import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors',
  {
    variants: {
      variant: {
        default: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-300',
        secondary: 'border-zinc-700/80 bg-zinc-800/90 text-zinc-300',
        destructive: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
        outline: 'text-zinc-300 border-zinc-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
