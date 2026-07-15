"use client";

import { useEffect, useState } from "react";

import { Card, InfoTooltip } from "@/components/ui";
import type { AiModelId, ReasoningEffort } from "@/domain/ai-models";

const GENERATION_PROGRESS_STEPS = [
  "Verificando o currículo pedagógico...",
  "Planejando a sequência de atividades...",
  "Gerando propostas alinhadas à aula...",
  "Validando a adequação aos critérios...",
  "Salvando atividades e relatórios...",
] as const;

const GENERATION_OVERRUN_MESSAGES = [
  "O processamento está levando um pouco mais que o esperado...",
  "Continuamos trabalhando no lote. O tempo pode variar conforme o modelo...",
] as const;

const EXPECTED_GENERATION_DURATION_MILLISECONDS = {
  "gpt-5.6-sol": 60_000,
  "gpt-5.6-terra": 50_000,
  "gpt-5.6-luna": 40_000,
  "gpt-5.4-mini": 35_000,
  "gpt-4.1-mini": 25_000,
  "gemini-3.5-flash": 25_000,
  "openai/gpt-oss-20b": 18_000,
} as const satisfies Record<AiModelId, number>;

const REASONING_EFFORT_DURATION_MULTIPLIER = {
  none: 0.7,
  minimal: 0.75,
  default: 1,
  low: 0.85,
  medium: 1,
  high: 1.35,
  xhigh: 1.7,
  max: 2,
} as const satisfies Record<ReasoningEffort, number>;

// A geração da resposta tende a ocupar a maior parte da espera. A última
// mensagem aparece apenas quando cerca de 90% do tempo estimado já passou.
const GENERATION_STEP_DURATION_RATIOS = [0.12, 0.15, 0.48, 0.15] as const;
const FINAL_STEP_DURATION_RATIO = 0.1;
const MINIMUM_OVERRUN_MESSAGE_DURATION_MILLISECONDS = 10_000;

type GenerationProgressProps = {
  model: AiModelId;
  reasoningEffort: ReasoningEffort | undefined;
};

export function getExpectedGenerationDurationMilliseconds(
  model: AiModelId,
  reasoningEffort: ReasoningEffort | undefined,
): number {
  const effortMultiplier = reasoningEffort
    ? REASONING_EFFORT_DURATION_MULTIPLIER[reasoningEffort]
    : 1;

  return Math.round(EXPECTED_GENERATION_DURATION_MILLISECONDS[model] * effortMultiplier);
}

export function getGenerationStepDelayMilliseconds(
  model: AiModelId,
  reasoningEffort: ReasoningEffort | undefined,
  stepIndex: number,
): number {
  const durationRatio = GENERATION_STEP_DURATION_RATIOS[stepIndex];

  if (durationRatio === undefined) {
    return 0;
  }

  return Math.round(
    getExpectedGenerationDurationMilliseconds(model, reasoningEffort) * durationRatio,
  );
}

export function GenerationProgress({ model, reasoningEffort }: GenerationProgressProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [overrunMessageIndex, setOverrunMessageIndex] = useState<number | null>(null);
  const expectedDurationMilliseconds = getExpectedGenerationDurationMilliseconds(
    model,
    reasoningEffort,
  );

  useEffect(() => {
    if (currentStepIndex < GENERATION_PROGRESS_STEPS.length - 1) {
      const timeout = window.setTimeout(() => {
        setCurrentStepIndex((index) => index + 1);
      }, getGenerationStepDelayMilliseconds(model, reasoningEffort, currentStepIndex));

      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(
      () => {
        setOverrunMessageIndex((index) =>
          index === null ? 0 : (index + 1) % GENERATION_OVERRUN_MESSAGES.length,
        );
      },
      overrunMessageIndex === null
        ? expectedDurationMilliseconds * FINAL_STEP_DURATION_RATIO
        : Math.max(
            MINIMUM_OVERRUN_MESSAGE_DURATION_MILLISECONDS,
            expectedDurationMilliseconds * 0.2,
          ),
    );

    return () => window.clearTimeout(timeout);
  }, [
    currentStepIndex,
    expectedDurationMilliseconds,
    model,
    overrunMessageIndex,
    reasoningEffort,
  ]);

  const currentMessage =
    overrunMessageIndex === null
      ? GENERATION_PROGRESS_STEPS[currentStepIndex]
      : GENERATION_OVERRUN_MESSAGES[overrunMessageIndex];

  return (
    <Card
      aria-busy="true"
      aria-labelledby="progresso-geracao-titulo"
      className="mt-6 overflow-hidden"
      padding="sm"
      raised={false}
      tone="soft"
    >
      <div className="relative flex items-center gap-3">
        <span
          aria-hidden="true"
          className="size-5 shrink-0 animate-spin rounded-full border-[3px] border-brand border-r-transparent motion-reduce:animate-none"
        />
        <p className="font-black" id="progresso-geracao-titulo">
          Gerando e validando o lote
        </p>
        <InfoTooltip label="Informações sobre o salvamento do lote">
          As atividades, os relatórios e o consumo de tokens serão salvos antes da revisão.
        </InfoTooltip>
      </div>

      <div
        aria-hidden="true"
        className="mt-4 h-1.5 overflow-hidden rounded-pill bg-surface/70"
      >
        <span className="generation-progress-indicator block h-full w-1/3 rounded-pill bg-brand" />
      </div>

      <p className="sr-only" aria-atomic="true" aria-live="polite">
        {currentMessage}
      </p>

      <div aria-hidden="true" className="mt-4 min-h-6">
        <p
          className="generation-step-enter text-sm font-bold text-ink"
          key={currentMessage}
        >
          {currentMessage}
        </p>
      </div>
    </Card>
  );
}
