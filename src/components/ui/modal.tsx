"use client";

import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";

import { Button } from "./button";
import { cx } from "./class-names";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = "Fechar modal",
  initialFocusRef,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;

    function getFocusableElements(): HTMLElement[] {
      return Array.from(dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter(
        (element) => element.getAttribute("aria-hidden") !== "true",
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    const focusFrame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current ?? getFocusableElements()[0] ?? dialog;
      target?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [initialFocusRef, onClose, open]);

  if (!open) {
    return null;
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 sm:items-center sm:p-6"
      onMouseDown={handleBackdropClick}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={cx(
          "max-h-[90vh] w-full overflow-y-auto rounded-t-xl border-2 border-border bg-surface p-6 shadow-2xl focus:outline-none sm:max-w-lg sm:rounded-xl sm:p-8",
          className,
        )}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-ink" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="mt-2 text-sm font-medium leading-6 text-muted" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          <Button aria-label={closeLabel} className="shrink-0 px-3" onClick={onClose} variant="ghost">
            <span aria-hidden="true" className="text-2xl leading-none">
              ×
            </span>
          </Button>
        </div>
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-8 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
