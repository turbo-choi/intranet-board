import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger";

const classes: Record<BadgeVariant, string> = {
  default: "border border-primary/35 bg-primary/15 text-primary",
  success: "border border-success/30 bg-success/20 text-emerald-300",
  warning: "border border-warning/60 bg-warning/30 text-textmain shadow-sm",
  danger: "border border-danger/30 bg-danger/20 text-red-300"
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", classes[variant], className)}
      {...props}
    />
  );
}
