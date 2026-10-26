import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-medium transition-all disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 active:scale-[0.98]',
        destructive: 'bg-rose-600 text-white shadow-xs hover:bg-rose-500 active:scale-[0.98]',
        outline:
          'border border-zinc-800 bg-zinc-900/90 text-zinc-200 shadow-2xs hover:bg-zinc-800/80 hover:text-white hover:border-zinc-700',
        secondary: 'bg-zinc-800 text-zinc-100 shadow-2xs hover:bg-zinc-700/90',
        ghost: 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100',
        link: 'text-indigo-400 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 rounded-lg gap-1.5 px-2.5 text-xs',
        xs: 'h-7 rounded-lg gap-1 px-2 text-[11px]',
        lg: 'h-10 rounded-xl px-5 text-sm',
        icon: 'size-9 rounded-xl',
        'icon-sm': 'size-8 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
