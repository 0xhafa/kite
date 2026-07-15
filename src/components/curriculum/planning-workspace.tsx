"use client";

import { AppShell } from "@/components/app-shell";
import { useAiSettings } from "@/components/ai/ai-settings";
import { CurriculumNavigator } from "@/components/curriculum/curriculum-navigator";
import type { AiModelSelection } from "@/domain/ai-models";
import type { Curriculum } from "@/domain/curriculum";
import type { CurriculumSelection } from "@/domain/curriculum-navigation";

type PlanningWorkspaceProps = {
  curriculum: Curriculum;
  initialModelSelection?: AiModelSelection;
  initialSelection?: CurriculumSelection;
  reviewBatchId?: string;
};

export function PlanningWorkspace({
  curriculum,
  initialModelSelection,
  initialSelection,
  reviewBatchId,
}: PlanningWorkspaceProps) {
  return (
    <AppShell
      initialModelSelection={initialModelSelection}
      mainClassName="max-w-5xl"
      sectionLabel="Planejamento"
    >
      <PlanningContent
        curriculum={curriculum}
        initialSelection={initialSelection}
        reviewBatchId={reviewBatchId}
      />
    </AppShell>
  );
}

function PlanningContent({
  curriculum,
  initialSelection,
  reviewBatchId,
}: Omit<PlanningWorkspaceProps, "initialModelSelection">) {
  const { selection } = useAiSettings();

  return (
    <CurriculumNavigator
      curriculum={curriculum}
      initialSelection={initialSelection}
      model={selection.model}
      reasoningEffort={selection.reasoningEffort}
      reviewBatchId={reviewBatchId}
    />
  );
}
