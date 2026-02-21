import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "danger";

const variantClass: Record<ButtonVariant, string> = {
  default: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-bg-main text-textmain hover:bg-bg-main/80",
  outline: "border border-border bg-surface text-textsub hover:bg-white/5 hover:text-textmain",
  danger: "bg-danger text-white hover:bg-danger/90"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50",
        variantClass[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
