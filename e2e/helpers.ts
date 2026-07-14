import { expect, type Page } from "@playwright/test";

export async function selectFirstLesson(page: Page) {
  await page.goto("/planejar");
  await page.getByRole("group", { name: "1. Tema" }).getByRole("button").first().click();
  await page.getByRole("group", { name: "2. Habilidade" }).getByRole("button").first().click();
  await page.getByRole("group", { name: "3. Objetivo" }).getByRole("button").first().click();
  await page.getByRole("group", { name: "4. Semana" }).getByRole("button").first().click();
  await page.getByRole("group", { name: "5. Aula" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Avançar para configuração" }).click();
}

export async function generateReviewBatch(
  page: Page,
  options: { duration?: string; activityCount?: string } = {},
) {
  await selectFirstLesson(page);
  if (options.duration) {
    await page.getByRole("spinbutton", { name: "Duração total" }).fill(options.duration);
  }
  if (options.activityCount) {
    await page
      .getByRole("combobox", { name: "Quantidade de atividades" })
      .selectOption(options.activityCount);
  }
  await page.getByRole("button", { name: "Confirmar e gerar atividades" }).click();
  await expect(page).toHaveURL(/\/revisar\?lote=/);
  await expect(page.getByRole("heading", { name: "Revise o lote" })).toBeVisible();
}
