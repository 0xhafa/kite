import { expect, test } from "@playwright/test";

import { generateReviewBatch } from "./helpers";

test("abre a trilha pelo topo e mantém as 80 aulas utilizáveis no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const trailLink = page.getByRole("link", { name: "Resumo da trilha" });
  await expect(trailLink).toBeVisible();
  await trailLink.click();

  await expect(page).toHaveURL("/trilha");
  await expect(page.getByRole("heading", { level: 1, name: "Resumo da trilha" })).toBeVisible();
  await expect(page.getByText("Fonemas", { exact: true }).last()).toBeVisible();
  await expect(page.getByTestId("trail-lesson")).toHaveCount(80);

  const lastLesson = page.getByTestId("trail-lesson").last();
  await expect(lastLesson.getByText("Geradas: 0", { exact: true })).toBeVisible();
  await expect(lastLesson.getByText("Revisadas: 0", { exact: true })).toBeVisible();

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
});

test("leva uma aula revisada para a biblioteca com o contexto filtrado", async ({ page }) => {
  await generateReviewBatch(page);
  const batchId = new URL(page.url()).searchParams.get("lote");
  expect(batchId).toBeTruthy();

  await page.getByRole("button", { name: "Rejeitar", exact: true }).click();
  await page.goto("/trilha");

  const firstLesson = page.getByTestId("trail-lesson").first();
  await expect(firstLesson.getByText(/Geradas: [1-9]/)).toBeVisible();
  await expect(firstLesson.getByText(/Revisadas: [1-9]/)).toBeVisible();

  const reviewedLink = firstLesson.getByRole("link", {
    name: "Ver atividades revisadas desta aula",
  });
  const href = await reviewedLink.getAttribute("href");
  expect(href).toBeTruthy();
  const expectedParameters = new URL(href ?? "", "http://kite.local").searchParams;
  expect([...expectedParameters.keys()]).toEqual([
    "themeId",
    "skillId",
    "objectiveId",
    "weekId",
    "lessonId",
  ]);

  await reviewedLink.click();
  await expect(page).toHaveURL(/\/atividades\?.*lessonId=/);
  await expect(page.getByRole("button", { name: "Ocultar filtros" })).toBeVisible();

  for (const [label, parameter] of [
    ["Tema", "themeId"],
    ["Habilidade", "skillId"],
    ["Objetivo", "objectiveId"],
    ["Semana", "weekId"],
    ["Aula", "lessonId"],
  ] as const) {
    await expect(page.getByRole("combobox", { name: label })).toHaveValue(
      expectedParameters.get(parameter) ?? "",
    );
  }

  const batch = page.locator(`section[aria-labelledby="lote-${batchId}"]`);
  await expect(batch).toBeVisible();
  const visibleBatches = page.locator('section[aria-labelledby^="lote-"]');
  const visibleBatchCount = await visibleBatches.count();
  for (let index = 0; index < visibleBatchCount; index += 1) {
    await expect(visibleBatches.nth(index)).toContainText("Semana 1 · Aula 1");
  }

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).toHaveURL(/\/atividades$/);
  await expect(page.getByText(/filtros ativos/)).toHaveCount(0);
  await expect(batch).toBeVisible();
  await expect(page.getByRole("link", { name: "Resumo da trilha" })).toBeVisible();
});
