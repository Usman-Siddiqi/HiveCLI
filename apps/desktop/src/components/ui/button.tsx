import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-secondary)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border-strong)] bg-[var(--accent)]/12 text-[var(--text)] hover:bg-[var(--accent)]/18",
        secondary:
          "border-[var(--border)] bg-white/4 text-[var(--text)] hover:bg-white/8",
        ghost:
          "border-transparent bg-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-white/6 hover:text-[var(--text)]",
        danger:
          "border-[color:rgba(255,122,144,0.32)] bg-[color:rgba(255,122,144,0.12)] text-[var(--text)] hover:bg-[color:rgba(255,122,144,0.16)]",
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
