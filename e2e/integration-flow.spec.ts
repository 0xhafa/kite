import { expect, test } from "@playwright/test";

import { generateReviewBatch } from "./helpers";

test("conclui geração, revisão, regeneração isolada e recarga do lote", async ({ page }) => {
  await generateReviewBatch(page);
  const reviewUrl = page.url();
  const activityHeading = page.locator("article h2");
  const activityDuration = page.locator("article").getByText(/^\d+ min$/);
  const firstTitle = await activityHeading.textContent();
  const firstDuration = await activityDuration.textContent();

  await expect(page.getByTestId("current-activity-version")).toHaveText("Versão 1");
  await page
    .getByRole("textbox", { name: "Feedback opcional" })
    .fill("Criar uma alternativa com outra ação da criança.");
  await page.getByRole("button", { name: "Rejeitar e gerar nova versão" }).click();

  await expect(page.getByText(/foi rejeitada e substituída apenas nesta posição/)).toBeVisible();
  await expect(page.getByTestId("current-activity-version")).toHaveText("Versão 2");
  await expect(page.getByText("0 de 3 revisadas · 25 min")).toBeVisible();
  await expect(activityDuration).toHaveText(firstDuration ?? "");
  await expect(activityHeading).not.toHaveText(firstTitle ?? "");
  await expect(
    page.getByRole("region", { name: "Consumo de tokens do lote" })
      .getByText("Reparos", { exact: true }).locator(".."),
  ).toContainText("180");

  const replacementTitle = await activityHeading.textContent();
  await page.reload();
  await expect(page).toHaveURL(reviewUrl);
  await expect(activityHeading).toHaveText(replacementTitle ?? "");
  await expect(page.getByTestId("current-activity-version")).toHaveText("Versão 2");
  await expect(page.getByText("0 de 3 revisadas · 25 min")).toBeVisible();

  await page.getByRole("button", { name: "Aprovar" }).click();
  await page.getByRole("button", { name: "Aprovar" }).click();
  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByRole("heading", { name: "Lote revisado" })).toBeFocused();
  await expect(page.getByText("3 aprovadas e 0 rejeitadas")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Lote revisado" })).toBeVisible();
  await expect(page.getByText("3 aprovadas e 0 rejeitadas")).toBeVisible();
});
