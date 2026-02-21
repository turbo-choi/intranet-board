import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-lg border border-border bg-bg-main px-3 text-sm text-textmain shadow-sm outline-none transition placeholder:text-textsub/70 focus-visible:ring-2 focus-visible:ring-primary/30",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
