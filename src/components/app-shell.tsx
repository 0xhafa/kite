"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import {
  AiSettingsProvider,
  useAiSettings,
} from "@/components/ai/ai-settings";
import { Button } from "@/components/ui";
import type { AiModelSelection } from "@/domain/ai-models";

type AppShellProps = {
  children: ReactNode;
  initialModelSelection?: AiModelSelection;
  mainClassName: string;
  sectionLabel: string;
};

export function AppShell({
  children,
  initialModelSelection,
  mainClassName,
  sectionLabel,
}: AppShellProps) {
  return (
    <AiSettingsProvider initialSelection={initialModelSelection}>
      <AppShellFrame mainClassName={mainClassName} sectionLabel={sectionLabel}>
        {children}
      </AppShellFrame>
    </AiSettingsProvider>
  );
}

function AppShellFrame({
  children,
  mainClassName,
  sectionLabel,
}: Omit<AppShellProps, "initialModelSelection">) {
  const { openSettings } = useAiSettings();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        className="sr-only rounded-md bg-surface px-4 py-3 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        href="#conteudo"
      >
        Ir para o conteúdo
      </a>

      <header className="border-b-2 border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              aria-label="Abrir configurações"
              className="size-touch shrink-0 !px-0"
              onClick={openSettings}
              title="Configurações"
              variant="ghost"
            >
              <svg
                aria-hidden="true"
                className="size-6"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9.6 3.2 10.2 2h3.6l.6 1.2a2 2 0 0 0 2.4 1l1.3-.4 1.8 3.1-.9 1a2 2 0 0 0 0 2.6l.9 1-1.8 3.1-1.3-.4a2 2 0 0 0-2.4 1l-.6 1.2h-3.6l-.6-1.2a2 2 0 0 0-2.4-1l-1.3.4-1.8-3.1.9-1a2 2 0 0 0 0-2.6l-.9-1 1.8-3.1 1.3.4a2 2 0 0 0 2.4-1Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
                <circle cx="12" cy="9.7" r="2.7" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </Button>
            <Link
              className="rounded-md text-xl font-black tracking-[-0.03em] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus"
              href="/"
            >
              Kite
            </Link>
          </div>
          <span className="rounded-pill bg-neutral-soft px-3 py-2 text-caption font-extrabold uppercase tracking-[0.08em] text-muted">
            {sectionLabel}
          </span>
        </div>
      </header>

      <main
        className={`mx-auto w-full px-5 py-10 sm:px-8 sm:py-14 ${mainClassName}`}
        id="conteudo"
      >
        {children}
      </main>
    </div>
  );
}
