import { expect, test, type Page } from "@playwright/test";

async function generateReviewBatchForLesson(page: Page, lessonIndex: number) {
  await page.goto("/planejar");
  await page.getByRole("group", { name: "1. Tema" }).getByRole("button").first().click();
  await page.getByRole("group", { name: "2. Habilidade" }).getByRole("button").first().click();
  await page.getByRole("group", { name: "3. Objetivo" }).getByRole("button").first().click();
  await page
    .getByRole("group", { name: "4. Aula" })
    .getByRole("button")
    .nth(lessonIndex)
    .click();
  await page.getByRole("button", { name: "Avançar para configuração" }).click();
  await page.getByRole("button", { name: "Confirmar e gerar atividades" }).click();
  await expect(page).toHaveURL(/\/revisar\?lote=/);
}

async function readTrailLessonCounts(page: Page, lessonIndex: number) {
  await page.goto("/trilha");
  const lesson = page.getByTestId("trail-lesson").nth(lessonIndex);
  const pendingText = await lesson.getByText(/^Pendentes: \d+$/).textContent();
  const reviewedText = await lesson.getByText(/^Revisadas: \d+$/).textContent();
  const pending = Number(pendingText?.replace("Pendentes: ", ""));
  const reviewed = Number(reviewedText?.replace("Revisadas: ", ""));

  expect(pending).not.toBeNaN();
  expect(reviewed).not.toBeNaN();

  return {
    hasReviewedLink:
      (await lesson.getByRole("link", {
        name: "Ver atividades revisadas desta aula",
      }).count()) > 0,
    pending,
    reviewed,
  };
}

test("abre a trilha pelo topo e mantém as 80 aulas utilizáveis no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const trailLink = page.getByRole("link", { name: "Resumo da trilha" });
  await expect(trailLink).toBeVisible();
  await trailLink.click();

  await expect(page).toHaveURL("/trilha");
  await expect(page.getByRole("heading", { level: 1, name: "Resumo da trilha" })).toBeVisible();
  await expect(page.getByText("Fonemas", { exact: true }).last()).toBeVisible();
  const trailTotals = page.getByLabel("Totais da trilha");
  await expect(trailTotals.getByText("Atividades revisadas", { exact: true })).toBeVisible();
  await expect(trailTotals.getByText("Atividades pendentes", { exact: true })).toBeVisible();
  await expect(trailTotals.getByText("Atividades geradas", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("trail-lesson")).toHaveCount(80);

  const lastLesson = page.getByTestId("trail-lesson").last();
  await expect(lastLesson.getByText("Pendentes: 0", { exact: true })).toBeVisible();
  await expect(lastLesson.getByText("Revisadas: 0", { exact: true })).toBeVisible();

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
});

test("leva somente aprovadas para a biblioteca e exclui rejeitadas da contagem", async ({ page }) => {
  const initialCounts = await readTrailLessonCounts(page, 4);
  await generateReviewBatchForLesson(page, 4);
  const batchId = new URL(page.url()).searchParams.get("lote");
  expect(batchId).toBeTruthy();

  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect(page.getByText("1 de 3 revisadas · 25 min")).toBeVisible();
  await page.getByRole("button", { name: "Rejeitar", exact: true }).click();
  await expect(page.getByText("2 de 3 revisadas · 25 min")).toBeVisible();
  const currentCounts = await readTrailLessonCounts(page, 4);

  expect(currentCounts).toEqual({
    hasReviewedLink: true,
    pending: initialCounts.pending + 1,
    reviewed: initialCounts.reviewed + 1,
  });

  const lesson = page.getByTestId("trail-lesson").nth(4);
  const reviewedLink = lesson.getByRole("link", {
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
    await expect(visibleBatches.nth(index)).toContainText("Semana 1 · Aula 5");
  }

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).toHaveURL(/\/atividades$/);
  await expect(page.getByText(/filtros ativos/)).toHaveCount(0);
  await expect(batch).toBeVisible();
  await expect(page.getByRole("link", { name: "Resumo da trilha" })).toBeVisible();
});

test("não adiciona contagens nem ação por um lote contendo somente rejeições", async ({ page }) => {
  const initialCounts = await readTrailLessonCounts(page, 3);
  await generateReviewBatchForLesson(page, 3);

  for (let activity = 0; activity < 3; activity += 1) {
    await page.getByRole("button", { name: "Rejeitar", exact: true }).click();
    await expect(page.getByText(`${activity + 1} de 3 revisadas · 25 min`)).toBeVisible();
  }

  const currentCounts = await readTrailLessonCounts(page, 3);

  expect(currentCounts).toEqual(initialCounts);
});

test("remove da trilha as contagens de um lote deletado", async ({ page }) => {
  const initialCounts = await readTrailLessonCounts(page, 2);
  await generateReviewBatchForLesson(page, 2);
  const batchId = new URL(page.url()).searchParams.get("lote");
  expect(batchId).toBeTruthy();

  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await expect(page.getByText("1 de 3 revisadas · 25 min")).toBeVisible();
  const currentCounts = await readTrailLessonCounts(page, 2);

  expect(currentCounts).toEqual({
    hasReviewedLink: true,
    pending: initialCounts.pending + 2,
    reviewed: initialCounts.reviewed + 1,
  });

  await page.goto("/atividades");
  const batch = page.locator(`section[aria-labelledby="lote-${batchId}"]`);
  await batch.getByRole("button", { name: /Deletar lote da aula/ }).click();
  const dialog = page.getByRole("dialog", { name: "Deletar lote?" });
  await dialog.getByLabel(/Para confirmar, digite deletar/).fill("deletar");
  await dialog.getByRole("button", { name: "Deletar lote", exact: true }).click();
  await expect(dialog).toBeHidden();

  const deletedCounts = await readTrailLessonCounts(page, 2);

  expect(deletedCounts).toEqual(initialCounts);
});
