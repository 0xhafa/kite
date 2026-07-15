import { expect, test } from "@playwright/test";

import { generateReviewBatch } from "./helpers";

test("revisa uma atividade persistida por vez e exibe relatório e tokens", async ({ page }) => {
  await generateReviewBatch(page);

  await expect(page.getByRole("heading", { name: "Olhar de investigador" })).toBeFocused();
  const usageSummary = page.getByRole("region", { name: "Consumo de tokens do lote" });
  await expect(usageSummary.getByText("Total", { exact: true }).locator("..")).toContainText("750");
  await expect(usageSummary.getByText("Geração", { exact: true }).locator("..")).toContainText("480");
  await expect(usageSummary.getByText("Validação", { exact: true }).locator("..")).toContainText("270");
  await expect(usageSummary.getByText("Reparos", { exact: true }).locator("..")).toContainText("0");
  await expect(page.getByText("Atividade 1 de 3")).toBeVisible();
  await expect(page.getByText("0 de 3 revisadas · 25 min")).toBeVisible();
  await expect(page.getByText("Validação aprovada", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: "Detalhes da validação" });
  await expect(dialog.getByText("Critérios", { exact: true }).locator("..")).toContainText("5");
  await expect(dialog.getByText("Atender ao padrão da atividade", { exact: true })).toBeVisible();
  await expect(dialog.getByText("DET-001")).toHaveCount(0);
  await expect(dialog.getByText("Ver evidência", { exact: true }).first()).toBeVisible();
  await dialog.getByText("Ver evidência", { exact: true }).first().click();
  await expect(
    dialog.getByText(
      "A atividade contém todas as informações necessárias e está associada ao lote correto.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(dialog.getByText("Origem do critério", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByRole("heading", { name: "Ouvidos atentos" })).toBeFocused();
  await expect(page.getByText("1 de 3 revisadas · 25 min")).toBeVisible();
});

test("exibe estados de carregamento, erro e vazio", async ({ page }) => {
  await page.goto("/revisar?estado=carregando");
  await expect(page.getByRole("status")).toContainText("Preparando atividades para revisão");

  await page.goto("/revisar?estado=erro");
  await expect(
    page.getByRole("alert", { name: "Não foi possível abrir a revisão" }),
  ).toContainText("Não foi possível abrir a revisão");

  await page.goto("/revisar?estado=vazio");
  await expect(page.getByText("Nenhuma atividade para revisar")).toBeVisible();
  await expect(page.getByText("Nenhum consumo de tokens foi registrado para este lote.")).toBeVisible();
});

test("mantém as decisões acessíveis em tela pequena", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await generateReviewBatch(page);

  const approveButton = page.getByRole("button", { name: "Aprovar" });
  const detailsButton = page.getByRole("button", { name: "Detalhes" });

  await expect(approveButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejeitar e gerar nova versão" })).toBeVisible();
  await expect(detailsButton).toBeVisible();

  await detailsButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Detalhes da validação" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detailsButton).toBeFocused();

  await approveButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Ouvidos atentos" })).toBeFocused();

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
});
