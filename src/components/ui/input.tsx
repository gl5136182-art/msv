import * as React from "react"
import { cn } from "cn"

// DESIGN §6: borda #d0d0d0, foco com borda e anel laranja de 1px, 44px no mobile e 40px no desktop.
function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive lg:h-10",
        className
      )}
      {...props}
    />
  )
}

export { Input }
