import { forwardRef, type HTMLAttributes } from "react";

import { cx } from "./class-names";

const toneClasses = {
  neutral: "bg-neutral-soft text-muted",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
} as const;

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof toneClasses;
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone = "neutral", ...props },
  ref,
) {
  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center rounded-pill px-3 py-1 text-caption font-extrabold uppercase tracking-[0.08em]",
        toneClasses[tone],
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

Badge.displayName = "Badge";
