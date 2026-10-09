import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { cn } from 'cn'

// shadcn/ui Drawer (vaul), restyled for AnyPay: an iOS-style bottom sheet on the card surface.
// vaul is built on Radix Dialog, so focus is trapped inside and returned when it closes.

function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-[1.75rem] border bg-card px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-card-foreground shadow-2xl outline-none',
          className,
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-3 mb-4 h-1.5 w-12 shrink-0 rounded-full bg-muted"
        />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      className={cn('text-xl font-bold tracking-title', className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description className={cn('text-muted-foreground', className)} {...props} />
  )
}

export { Drawer, DrawerContent, DrawerDescription, DrawerTitle }
