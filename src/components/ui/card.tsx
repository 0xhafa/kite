import { forwardRef, type HTMLAttributes } from "react";

import { cx } from "./class-names";

const toneClasses = {
  surface: "border-border bg-surface",
  soft: "border-transparent bg-brand-soft",
  outlined: "border-border bg-transparent",
} as const;

const paddingClasses = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: keyof typeof toneClasses;
  padding?: keyof typeof paddingClasses;
  raised?: boolean;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    className,
    tone = "surface",
    padding = "md",
    raised = true,
    ...props
  },
  ref,
) {
  return (
    <div
      className={cx(
        "rounded-lg border-2",
        toneClasses[tone],
        paddingClasses[padding],
        raised && "shadow-raised",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

Card.displayName = "Card";
