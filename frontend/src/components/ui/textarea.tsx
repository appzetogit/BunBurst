import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground min-h-24 w-full rounded-lg border bg-card px-3 py-2 text-sm shadow-xs transition-[color,box-shadow,border-color] outline-none",
        "focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
