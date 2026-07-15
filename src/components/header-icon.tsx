import type { ReactNode } from "react";

type HeaderIconTooltipProps = {
  align?: "center" | "left" | "right";
  children: ReactNode;
  label: string;
};

const tooltipAlignment = {
  center: "left-1/2 -translate-x-1/2",
  left: "left-0",
  right: "right-0",
} as const;

export function HeaderIconTooltip({
  align = "center",
  children,
  label,
}: HeaderIconTooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        className={`pointer-events-none invisible absolute top-full z-50 mt-2 whitespace-nowrap rounded-md bg-ink px-3 py-2 text-xs font-extrabold text-surface opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 motion-reduce:transition-none ${tooltipAlignment[align]}`}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}

export function ReviewedActivitiesIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.5 8.5h15v10.75a1.25 1.25 0 0 1-1.25 1.25H5.75a1.25 1.25 0 0 1-1.25-1.25V8.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M3.5 4.75c0-.69.56-1.25 1.25-1.25h14.5c.69 0 1.25.56 1.25 1.25V8.5h-17V4.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m8.75 14.25 2.1 2.1 4.4-4.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function TrailSummaryIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 5.5h5.5M12.5 18.5H18M8.75 5.5c4.8 0 6.5 2 6.5 5.2v2.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="5" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="18.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m13.25 12.5 2 2 2.75-3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function PlanNewBatchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.5 3.5h8l3 3v14h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M14.5 3.5v3h3M11 10v6M8 13h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.5 2.5h5l.5 2.2c.6.2 1.1.5 1.6.9l2.1-.7 2.5 4.2-1.7 1.5c.1.6.1 1.2 0 1.8l1.7 1.5-2.5 4.2-2.1-.7c-.5.4-1 .7-1.6.9l-.5 2.2h-5L9 19.3c-.6-.2-1.1-.5-1.6-.9l-2.1.7-2.5-4.2 1.7-1.5a7 7 0 0 1 0-1.8L2.8 10l2.5-4.2 2.1.7c.5-.4 1-.7 1.6-.9l.5-2.2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="11.5" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
