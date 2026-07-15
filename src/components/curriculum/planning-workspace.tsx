"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { CurriculumNavigator } from "@/components/curriculum/curriculum-navigator";
import { Button, InfoTooltip, Modal } from "@/components/ui";
import type { Curriculum } from "@/domain/curriculum";
import {
  AI_MODELS,
  aiModelIdSchema,
  defaultAiModelSelection,
  getAiModelDefinition,
  getDefaultReasoningEffort,
  reasoningEffortSchema,
  type AiModelId,
  type ReasoningEffort,
} from "@/domain/ai-models";

type PlanningWorkspaceProps = {
  curriculum: Curriculum;
};

const reasoningEffortLabels = {
  none: "Nenhum",
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  xhigh: "Muito alto",
  max: "Máximo",
} as const satisfies Record<ReasoningEffort, string>;

export function PlanningWorkspace({ curriculum }: PlanningWorkspaceProps) {
  const modelSelectRef = useRef<HTMLSelectElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [model, setModel] = useState<AiModelId>(defaultAiModelSelection.model);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort | undefined>(
    defaultAiModelSelection.reasoningEffort,
  );

  const selectedModel = getAiModelDefinition(model);

  function updateModel(value: string) {
    const nextModel = aiModelIdSchema.parse(value);
    setModel(nextModel);
    setReasoningEffort(getDefaultReasoningEffort(nextModel));
  }

  function updateReasoningEffort(value: string) {
    setReasoningEffort(reasoningEffortSchema.parse(value));
  }

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
              onClick={() => setSettingsOpen(true)}
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
            Planejamento
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14" id="conteudo">
        <CurriculumNavigator
          curriculum={curriculum}
          model={model}
          reasoningEffort={reasoningEffort}
        />
      </main>

      <Modal
        className="sm:max-w-2xl"
        closeLabel="Fechar configurações"
        description="Escolha o modelo usado para gerar e validar as atividades."
        footer={<Button onClick={() => setSettingsOpen(false)}>Concluir</Button>}
        initialFocusRef={modelSelectRef}
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        title="Configurações"
      >
        <section aria-labelledby="configuracao-modelo-ia">
          <h3 className="text-lg font-black" id="configuracao-modelo-ia">
            Modelo de IA
          </h3>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="relative flex w-full items-center gap-2">
                <label className="font-extrabold" htmlFor="modelo-ia">
                  Modelo
                </label>
                <InfoTooltip label="Informações sobre o modelo selecionado">
                  <strong className="font-extrabold">{selectedModel.description}</strong>{" "}
                  Entrada: US$ {selectedModel.pricingPerMillionTokensUsd.input}/1M · saída: US${" "}
                  {
                    selectedModel.pricingPerMillionTokensUsd.output
                  }/1M tokens.
                </InfoTooltip>
              </div>
              <select
                className="mt-2 min-h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-base font-extrabold text-ink focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                id="modelo-ia"
                onChange={(event) => updateModel(event.target.value)}
                ref={modelSelectRef}
                value={model}
              >
                {AI_MODELS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="relative flex w-full items-center gap-2">
                <label className="font-extrabold" htmlFor="esforco-raciocinio">
                  Esforço de raciocínio
                </label>
                <InfoTooltip label="Informações sobre o esforço de raciocínio">
                  {selectedModel.reasoningEfforts.length === 0
                    ? "Este modelo não expõe controle de esforço."
                    : "Mais esforço pode melhorar tarefas difíceis, mas aumenta tokens e latência."}
                </InfoTooltip>
              </div>
              <select
                className="mt-2 min-h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-base font-extrabold text-ink disabled:cursor-not-allowed disabled:bg-neutral-soft disabled:text-muted focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                disabled={selectedModel.reasoningEfforts.length === 0}
                id="esforco-raciocinio"
                onChange={(event) => updateReasoningEffort(event.target.value)}
                value={reasoningEffort ?? "not-applicable"}
              >
                {selectedModel.reasoningEfforts.length === 0 ? (
                  <option value="not-applicable">Não se aplica</option>
                ) : (
                  selectedModel.reasoningEfforts.map((effort) => (
                    <option key={effort} value={effort}>
                      {reasoningEffortLabels[effort]}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </section>
      </Modal>
    </div>
  );
}
