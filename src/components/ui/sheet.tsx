import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/65 backdrop-blur-xs transition-opacity',
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = 'right',
  hideClose = false,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
  hideClose?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed z-50 flex flex-col bg-zinc-900 text-zinc-100 shadow-2xl transition ease-in-out',
          side === 'right' &&
            'inset-y-0 right-0 h-full w-[86vw] max-w-80 border-l border-zinc-800',
          side === 'left' &&
            'inset-y-0 left-0 h-full w-[84vw] max-w-72 border-r border-zinc-800',
          side === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t border-zinc-800',
          side === 'top' && 'inset-x-0 top-0 border-b border-zinc-800',
          className
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <SheetPrimitive.Close className="absolute right-3.5 top-3.5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none cursor-pointer">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1 p-4 border-b border-zinc-800/80', className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-sm font-semibold text-zinc-100', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-xs text-zinc-400', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
