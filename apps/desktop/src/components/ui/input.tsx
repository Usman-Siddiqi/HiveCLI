import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-[var(--text)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)]",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";
