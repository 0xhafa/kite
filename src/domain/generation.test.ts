import { describe, expect, it } from "vitest";

import {
  type Activity,
  type ActivityGroup,
  activityGroupSchema,
  activitySchema,
  applyActivityRegeneration,
} from "./generation";
import { generationModelOutputSchema } from "./model-contracts";

const approvedActivity: Activity = {
  id: "activity-1-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-1",
  slotIndex: 0,
  title: "Escuta inicial",
  description: "Escutar e identificar o som inicial.",
  durationMinutes: 10,
  status: "approved",
  version: 1,
  generationRunId: "run-1",
};

const rejectedActivity: Activity = {
  id: "activity-2-v1",
  batchId: "batch-1",
  logicalActivityId: "activity-2",
  slotIndex: 1,
  title: "Trilha sonora",
  description: "Percorrer a trilha dizendo palavras.",
  durationMinutes: 15,
  status: "rejected",
  version: 1,
  generationRunId: "run-2",
};

const group: ActivityGroup = {
  batchId: "batch-1",
  requestedDurationMinutes: 25,
  requestedActivityCount: 2,
  activities: [approvedActivity, rejectedActivity],
};

const replacement: Activity = {
  ...rejectedActivity,
  id: "activity-2-v2",
  title: "Caça ao som",
  description: "Encontrar imagens que começam com o som indicado.",
  status: "draft",
  version: 2,
  replacesActivityId: rejectedActivity.id,
  generationRunId: "run-3",
};

describe("invariantes de atividades", () => {
  it("aceita apenas os status de atividade previstos", () => {
    expect(activitySchema.safeParse({ ...rejectedActivity, status: "published" }).success).toBe(
      false,
    );
    expect(activitySchema.parse(approvedActivity).status).toBe("approved");
  });

  it("exige que as durações individuais somem a duração do grupo", () => {
    expect(activityGroupSchema.parse(group).requestedDurationMinutes).toBe(25);

    const invalidGroup = {
      ...group,
      activities: [{ ...approvedActivity, durationMinutes: 9 }, rejectedActivity],
    };
    expect(activityGroupSchema.safeParse(invalidGroup).success).toBe(false);
  });

  it("regenera somente a posição rejeitada e preserva as aprovadas e a duração total", () => {
    const regeneratedGroup = applyActivityRegeneration({ group, replacement });

    expect(regeneratedGroup.activities[0]).toEqual(approvedActivity);
    expect(regeneratedGroup.activities[1]).toEqual(replacement);
    expect(regeneratedGroup.activities.reduce((total, item) => total + item.durationMinutes, 0)).toBe(
      group.requestedDurationMinutes,
    );
  });

  it("permite preparar uma substituta quando uma atividade aprovada é rejeitada depois", () => {
    const approvedReplacement: Activity = {
      ...approvedActivity,
      id: "activity-1-v2",
      title: "Nova escuta inicial",
      status: "draft",
      version: 2,
      replacesActivityId: approvedActivity.id,
      generationRunId: "run-3",
    };

    const regeneratedGroup = applyActivityRegeneration({
      group,
      replacement: approvedReplacement,
    });

    expect(regeneratedGroup.activities).toEqual([approvedReplacement, rejectedActivity]);
  });

  it("recusa uma substituta que altere a duração individual", () => {
    expect(
      (() =>
        applyActivityRegeneration({
          group,
          replacement: { ...replacement, durationMinutes: 14 },
        })) as () => unknown,
    ).toThrow(/durationMinutes/);
  });
});

describe("contrato de saída do gerador", () => {
  const output = {
    plan: {
      totalDurationMinutes: 25,
      activities: [
        {
          slotIndex: 0,
          durationMinutes: 10,
          primaryChildAction: "Escutar",
          pedagogicalFunction: "Percepção auditiva",
        },
        {
          slotIndex: 1,
          durationMinutes: 15,
          primaryChildAction: "Nomear",
          pedagogicalFunction: "Produção oral",
        },
      ],
    },
    activities: [
      {
        slotIndex: 0,
        title: "Escuta",
        description: "Escutar palavras.",
        durationMinutes: 10,
        consideredRuleIds: ["PED-001"],
      },
      {
        slotIndex: 1,
        title: "Nomeação",
        description: "Nomear imagens.",
        durationMinutes: 15,
        consideredRuleIds: ["PED-001"],
      },
    ],
    uncertainties: [],
  };

  it("mantém posições e durações do plano na saída", () => {
    expect(generationModelOutputSchema.parse(output).activities).toHaveLength(2);
    expect(
      generationModelOutputSchema.safeParse({
        ...output,
        activities: [{ ...output.activities[0], durationMinutes: 9 }, output.activities[1]],
      }).success,
    ).toBe(false);
  });
});
