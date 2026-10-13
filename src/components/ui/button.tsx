import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// DESIGN §6: raio de 4–6px, 44px no mobile e 40px no desktop (≥1024px), sem efeito de "levantar".
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-semibold whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-laranja-145",
        secondary:
          "border-input bg-card text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        ghost:
          "text-foreground hover:bg-accent aria-expanded:bg-accent",
        link: "h-auto px-0 font-normal text-foreground underline underline-offset-4 hover:text-laranja-145",
      },
      size: {
        default: "h-11 px-4 lg:h-10",
        sm: "h-11 px-3 text-[13px] lg:h-8",
        icon: "size-11 lg:size-10",
        "icon-sm": "size-11 lg:size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
