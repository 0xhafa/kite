"use client";

import { useId, type ReactNode } from "react";

export type InfoTooltipProps = {
  label: string;
  children: ReactNode;
};

export function InfoTooltip({ label, children }: InfoTooltipProps) {
  const tooltipId = useId();

  return (
    <>
      <button
        aria-describedby={tooltipId}
        aria-label={label}
        className="peer inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-muted bg-surface text-caption font-black leading-none text-muted transition-colors hover:border-ink hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
        type="button"
      >
        i
      </button>
      <span
        className="pointer-events-none invisible absolute left-0 right-0 top-full z-20 mt-2 rounded-md bg-ink px-4 py-3 text-left text-sm font-medium leading-6 text-surface opacity-0 shadow-xl transition-opacity peer-hover:visible peer-hover:opacity-100 peer-focus:visible peer-focus:opacity-100 motion-reduce:transition-none"
        id={tooltipId}
        role="tooltip"
      >
        {children}
      </span>
    </>
  );
}
