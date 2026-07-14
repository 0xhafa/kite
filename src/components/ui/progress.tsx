import { type HTMLAttributes } from "react";

import { cx } from "./class-names";

const toneClasses = {
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

export type ProgressProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  value: number;
  max?: number;
  label: string;
  tone?: keyof typeof toneClasses;
  showValue?: boolean;
};

export function Progress({
  value,
  max = 100,
  label,
  tone = "brand",
  showValue = true,
  className,
  ...props
}: ProgressProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const percentage = (safeValue / safeMax) * 100;

  return (
    <div className={cx("w-full", className)} {...props}>
      <div className="mb-2 flex items-baseline justify-between gap-4 text-sm font-bold">
        <span>{label}</span>
        {showValue ? <span className="text-muted">{Math.round(percentage)}%</span> : null}
      </div>
      <div
        aria-label={label}
        aria-valuemax={safeMax}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        className="h-3 overflow-hidden rounded-pill bg-track"
        role="progressbar"
      >
        <div
          className={cx("h-full rounded-pill transition-[width] motion-reduce:transition-none", toneClasses[tone])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
