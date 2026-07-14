import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cx } from "./class-names";

const variantClasses = {
  primary:
    "border-ink bg-ink text-surface shadow-action hover:-translate-y-0.5 hover:bg-ink-strong active:translate-y-0 active:shadow-none",
  secondary:
    "border-border bg-surface text-ink shadow-raised hover:-translate-y-0.5 hover:border-muted active:translate-y-0 active:shadow-none",
  ghost: "border-transparent bg-transparent text-ink hover:bg-brand-soft active:bg-brand-soft-strong",
  danger: "border-danger bg-danger text-surface hover:bg-danger-strong active:bg-danger-deep",
} as const;

const sizeClasses = {
  sm: "min-h-touch px-4 py-2 text-sm",
  md: "min-h-touch px-5 py-2.5 text-base",
  lg: "min-h-12 px-6 py-3 text-lg",
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    fullWidth = false,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border-2 font-extrabold transition-[transform,background-color,border-color,box-shadow] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 motion-reduce:transition-none",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      ref={ref}
      type={type}
      {...props}
    />
  );
});

Button.displayName = "Button";
