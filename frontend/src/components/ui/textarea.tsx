import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-28 w-full rounded-lg border border-border bg-bg-main px-3 py-2 text-sm text-textmain shadow-sm outline-none transition placeholder:text-textsub/70 focus-visible:ring-2 focus-visible:ring-primary/30",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
