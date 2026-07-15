import { expect, test } from "@playwright/test";

import { generateReviewBatch } from "./helpers";

test("filtra a biblioteca e exige a confirmação textual para deletar um lote", async ({ page }) => {
  await generateReviewBatch(page);
  const batchId = new URL(page.url()).searchParams.get("lote");
  expect(batchId).toBeTruthy();

  await page.getByRole("button", { name: "Rejeitar", exact: true }).click();
  await page.goto("/atividades");

  const batch = page.locator(`section[aria-labelledby="lote-${batchId}"]`);
  await expect(batch).toBeVisible();
  await expect(batch.getByText("Rejeitada", { exact: true })).toBeVisible();
  await expect(batch.getByRole("link", { name: "Abrir resumo do lote" })).toHaveCount(0);

  const usageSummary = batch.getByRole("region", { name: "Consumo de tokens do lote" });
  await usageSummary
    .getByRole("button", { name: "Ver consumo e custo estimado do lote" })
    .click();
  const usageDetails = usageSummary.getByRole("tooltip");
  await expect(
    usageDetails.getByText("Total de tokens", { exact: true }).locator(".."),
  ).toContainText("750");
  await expect(
    usageDetails.getByText("Custo estimado", { exact: true }).locator(".."),
  ).toContainText("US$");

  const copyActivityButton = batch.getByRole("button", { name: "Copiar texto da atividade" });
  await copyActivityButton.click();
  await expect(batch.getByRole("button", { name: "Texto copiado" })).toBeVisible();

  const showActivityButton = batch.getByRole("button", { name: "Expandir atividade" });
  await expect(showActivityButton).toHaveAttribute("aria-expanded", "false");
  const activityContentId = await showActivityButton.getAttribute("aria-controls");
  const activityContent = batch.locator(`[id="${activityContentId}"]`);
  await expect(activityContent).toBeHidden();
  await showActivityButton.click();
  await expect(
    batch.getByRole("button", { name: "Recolher atividade" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(activityContent).toBeVisible();

  const showFiltersButton = page.getByRole("button", { name: "Mostrar filtros" });
  await expect(showFiltersButton).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("combobox", { name: "Habilidade" })).toHaveCount(0);
  await showFiltersButton.click();
  await expect(page.getByRole("button", { name: "Ocultar filtros" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  await page.getByRole("combobox", { name: "Habilidade" }).selectOption({ index: 1 });
  await page.getByRole("combobox", { name: "Objetivo" }).selectOption({ index: 1 });
  await page.getByRole("combobox", { name: "Situação" }).selectOption("in_progress");
  await expect(batch).toBeVisible();

  const objective = await batch.getByRole("heading", { level: 2 }).textContent();
  await page.getByRole("searchbox", { name: "Buscar" }).fill(objective ?? "");
  await expect(batch).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar" }).fill("resultado inexistente xyz");
  await expect(page.getByRole("heading", { name: "Nenhum resultado para estes filtros" })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(batch).toBeVisible();

  await batch.getByRole("button", { name: /Deletar lote da aula/ }).click();
  const dialog = page.getByRole("dialog", { name: "Deletar lote?" });
  const deleteButton = dialog.getByRole("button", { name: "Deletar lote", exact: true });
  const confirmation = dialog.getByLabel(/Para confirmar, digite deletar/);

  await expect(deleteButton).toBeDisabled();
  await confirmation.fill("DELETAR");
  await expect(deleteButton).toBeDisabled();
  await confirmation.fill("deletar");
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  await expect(dialog).toBeHidden();
  await expect(batch).toHaveCount(0);
  await page.reload();
  await expect(page.locator(`section[aria-labelledby="lote-${batchId}"]`)).toHaveCount(0);
});
