"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button, InfoTooltip, Modal } from "@/components/ui";
import {
  AI_PROVIDERS,
  aiModelIdSchema,
  aiModelSelectionSchema,
  aiProviderIdSchema,
  defaultAiModelSelection,
  getAiModelDefinition,
  getAiModelsForProvider,
  getDefaultAiModelForProvider,
  getDefaultReasoningEffort,
  reasoningEffortSchema,
  type AiModelSelection,
  type ReasoningEffort,
} from "@/domain/ai-models";

type AiSettingsContextValue = {
  selection: AiModelSelection;
  openSettings: () => void;
};

type AiSettingsProviderProps = {
  children: ReactNode;
  initialSelection?: AiModelSelection;
};

const AiSettingsContext = createContext<AiSettingsContextValue | null>(null);

const reasoningEffortLabels = {
  none: "Nenhum",
  minimal: "Mínimo",
  default: "Padrão",
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  xhigh: "Muito alto",
  max: "Máximo",
} as const satisfies Record<ReasoningEffort, string>;

function selectionForModel(model: AiModelSelection["model"]): AiModelSelection {
  const reasoningEffort = getDefaultReasoningEffort(model);

  return aiModelSelectionSchema.parse({
    model,
    ...(reasoningEffort ? { reasoningEffort } : {}),
  });
}

export function AiSettingsProvider({
  children,
  initialSelection = defaultAiModelSelection,
}: AiSettingsProviderProps) {
  const modelSelectRef = useRef<HTMLSelectElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selection, setSelection] = useState<AiModelSelection>(() =>
    aiModelSelectionSchema.parse(initialSelection),
  );
  const selectedModel = getAiModelDefinition(selection.model);
  const providerModels = getAiModelsForProvider(selectedModel.provider);

  function updateProvider(value: string) {
    const provider = aiProviderIdSchema.parse(value);
    setSelection(selectionForModel(getDefaultAiModelForProvider(provider).id));
  }

  function updateModel(value: string) {
    setSelection(selectionForModel(aiModelIdSchema.parse(value)));
  }

  function updateReasoningEffort(value: string) {
    setSelection(
      aiModelSelectionSchema.parse({
        model: selection.model,
        reasoningEffort: reasoningEffortSchema.parse(value),
      }),
    );
  }

  return (
    <AiSettingsContext.Provider
      value={{ selection, openSettings: () => setSettingsOpen(true) }}
    >
      {children}
      <Modal
        className="sm:max-w-2xl"
        closeLabel="Fechar configurações"
        description="Escolha o provedor e o modelo das próximas gerações ou regenerações."
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
              <label className="font-extrabold" htmlFor="provedor-ia">
                Provedor
              </label>
              <select
                className="mt-2 min-h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-base font-extrabold text-ink focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                id="provedor-ia"
                onChange={(event) => updateProvider(event.target.value)}
                value={selectedModel.provider}
              >
                {AI_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="relative flex w-full items-center gap-2">
                <label className="font-extrabold" htmlFor="modelo-ia">
                  Modelo
                </label>
                <InfoTooltip label="Informações sobre o modelo selecionado">
                  <strong className="font-extrabold">{selectedModel.description}</strong>{" "}
                  {selectedModel.freeTier ? `${selectedModel.freeTier.description} Preço pago: ` : ""}
                  Entrada: US$ {selectedModel.pricingPerMillionTokensUsd.input}/1M · saída: US${" "}
                  {selectedModel.pricingPerMillionTokensUsd.output}/1M tokens.
                </InfoTooltip>
              </div>
              <select
                className="mt-2 min-h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-base font-extrabold text-ink focus-visible:border-focus focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                id="modelo-ia"
                onChange={(event) => updateModel(event.target.value)}
                ref={modelSelectRef}
                value={selection.model}
              >
                {providerModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
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
                value={selection.reasoningEffort ?? "not-applicable"}
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
    </AiSettingsContext.Provider>
  );
}

export function useAiSettings(): AiSettingsContextValue {
  const context = useOptionalAiSettings();

  if (!context) {
    throw new Error("As configurações de IA precisam estar dentro de AiSettingsProvider.");
  }

  return context;
}

export function useOptionalAiSettings(): AiSettingsContextValue | null {
  return useContext(AiSettingsContext);
}
