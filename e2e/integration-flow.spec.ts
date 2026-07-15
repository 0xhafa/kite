import { expect, test } from "@playwright/test";

import { generateReviewBatch } from "./helpers";

test("conclui geração, revisão, regeneração isolada e recarga do lote", async ({ page }) => {
  await generateReviewBatch(page);
  const reviewUrl = page.url();
  const activityHeading = page.locator("article h2");
  const activityDuration = page.locator("article").getByText(/^\d+ min$/);
  const firstTitle = await activityHeading.textContent();
  const firstDuration = await activityDuration.textContent();

  await page.getByRole("button", { name: "Abrir configurações" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "Configurações" });
  await settingsDialog.getByLabel("Provedor", { exact: true }).selectOption("gemini");
  await settingsDialog
    .getByLabel("Esforço de raciocínio", { exact: true })
    .selectOption("low");
  await settingsDialog.getByRole("button", { name: "Concluir" }).click();

  await expect(page.getByTestId("current-activity-version")).toHaveText("Versão 1");
  await page
    .getByRole("textbox", { name: "Feedback opcional" })
    .fill("Criar uma alternativa com outra ação da criança.");
  await page.getByRole("button", { name: "Ajustar atividade" }).click();

  await expect(page.getByText(/foi ajustada em uma nova versão, sem alterar as demais/)).toBeVisible();
  await expect(page.getByTestId("current-activity-version")).toHaveText("Versão 2");
  await expect(page.getByText("0 de 3 revisadas · 25 min")).toBeVisible();
  await expect(activityDuration).toHaveText(firstDuration ?? "");
  await expect(activityHeading).not.toHaveText(firstTitle ?? "");
  await page.getByRole("button", { name: "Abrir configurações" }).click();
  await expect(
    page.getByRole("dialog", { name: "Configurações" }).getByLabel("Modelo", {
      exact: true,
    }),
  ).toHaveValue("gemini-3.5-flash");
  await page
    .getByRole("dialog", { name: "Configurações" })
    .getByRole("button", { name: "Concluir" })
    .click();
  const usageSummary = page.getByRole("region", { name: "Consumo de tokens do lote" });
  await usageSummary
    .getByRole("button", { name: "Ver consumo e custo estimado do lote" })
    .click();
  await expect(
    usageSummary.getByRole("tooltip")
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
  await page.getByRole("button", { name: "Rejeitar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lote revisado" })).toBeFocused();
  await expect(page.getByText("2 aprovadas e 1 rejeitada")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Lote revisado" })).toBeVisible();
  await expect(page.getByText("2 aprovadas e 1 rejeitada")).toBeVisible();
  await page.getByRole("button", { name: "Rever atividades" }).click();
  const approvedButton = page.getByRole("button", { name: "Aprovada", exact: true });
  await expect(approvedButton).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("textbox", { name: "Feedback opcional" })
    .fill("Rejeitar depois da aprovação e gerar outra alternativa.");
  await page.getByRole("button", { name: "Ajustar atividade" }).click();
  await expect(page.getByText(/foi ajustada em uma nova versão, sem alterar as demais/)).toBeVisible();
  await expect(page.getByTestId("current-activity-version")).toHaveText("Versão 3");
  await expect(page.getByText("2 de 3 revisadas · 25 min")).toBeVisible();
  const finalReplacementTitle = await activityHeading.textContent();
  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByRole("heading", { name: "Lote revisado" })).toBeVisible();
  await expect(page.getByText("2 aprovadas e 1 rejeitada")).toBeVisible();

  await page.getByRole("link", { name: "Ver atividades revisadas" }).click();
  await expect(page).toHaveURL(/\/atividades$/);
  await expect(page.getByRole("heading", { level: 1, name: "Atividades revisadas" })).toBeVisible();
  await expect(page.getByText(finalReplacementTitle ?? "", { exact: true }).first()).toBeVisible();
  const batchId = new URL(reviewUrl).searchParams.get("lote");
  const reviewedBatch = page.locator(`section[aria-labelledby="lote-${batchId}"]`);
  await expect(reviewedBatch.getByText("Lote concluído", { exact: true })).toBeVisible();
  await expect(reviewedBatch.getByText("Rejeitada", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Kite", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("status")).toContainText(/atividades? revisadas?/);
  await expect(page.getByText("Nenhum lote gerado ainda")).toHaveCount(0);
});
