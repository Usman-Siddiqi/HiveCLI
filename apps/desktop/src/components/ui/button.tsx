import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-[var(--accent)] bg-[var(--accent)] text-[#17120b] hover:bg-[#d59843]",
        secondary:
          "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[rgba(255,255,255,0.04)]",
        ghost:
          "border-transparent bg-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text)]",
        danger:
          "border-[var(--danger)] bg-[var(--danger)] text-[#180d0a] hover:bg-[#cd7664]",
      },
      size: {
        default: "h-10",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
