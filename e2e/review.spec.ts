import { expect, test } from "@playwright/test";

import { generateReviewBatch } from "./helpers";

test("revisa uma atividade persistida por vez e exibe relatório e tokens", async ({ page }) => {
  await generateReviewBatch(page);

  const activityHeading = page.locator("article h2");
  const firstActivityTitle = await activityHeading.textContent();
  await expect(activityHeading).toBeFocused();

  const settingsButton = page.getByRole("button", { name: "Abrir configurações" });
  await expect(settingsButton).toBeVisible();
  await settingsButton.click();
  const settingsDialog = page.getByRole("dialog", { name: "Configurações" });
  await expect(settingsDialog.getByLabel("Modelo", { exact: true })).toHaveValue(
    "gpt-5.6-sol",
  );
  await expect(
    settingsDialog.getByLabel("Esforço de raciocínio", { exact: true }),
  ).toHaveValue("medium");
  await settingsDialog.getByRole("button", { name: "Concluir" }).click();

  const usageSummary = page.getByRole("region", { name: "Consumo de tokens do lote" });
  const technicalDetails = usageSummary.getByRole("tooltip");
  const technicalDetailsTrigger = usageSummary.getByRole("button", {
    name: "Ver consumo e custo estimado do lote",
  });
  await expect(technicalDetails).toBeHidden();
  await expect(usageSummary.getByText("Total de tokens", { exact: true })).toBeHidden();
  await expect(usageSummary.getByText("Geração", { exact: true })).toBeHidden();
  await expect(usageSummary.getByText("Validação", { exact: true })).toBeHidden();
  await expect(usageSummary.getByText("Reparos", { exact: true })).toBeHidden();
  await expect(usageSummary.getByText("Chamadas", { exact: true })).toBeHidden();

  await technicalDetailsTrigger.hover();
  await expect(technicalDetails).toBeVisible();
  await expect(technicalDetails.getByText("Total de tokens", { exact: true }).locator("..")).toContainText("750");
  await expect(technicalDetails.getByText("Geração", { exact: true }).locator("..")).toContainText("480");
  await activityHeading.hover();
  await expect(technicalDetails).toBeHidden();

  await technicalDetailsTrigger.focus();
  await expect(technicalDetails).toBeVisible();
  await activityHeading.focus();
  await expect(technicalDetails).toBeHidden();

  await technicalDetailsTrigger.click();
  await expect(technicalDetails).toBeVisible();
  await activityHeading.click();
  await expect(technicalDetails).toBeVisible();
  await expect(page.getByText("Atividade 1 de 3")).toBeVisible();
  await expect(page.getByText("0 de 3 revisadas · 25 min")).toBeVisible();
  await expect(page.getByText("Validação aprovada", { exact: true })).toHaveCount(0);

  const detailsButton = page
    .locator("article")
    .getByRole("button", { name: "Detalhes", exact: true });
  await expect(detailsButton).toHaveAttribute("aria-expanded", "false");
  await detailsButton.click();
  await expect(detailsButton).toHaveAttribute("aria-expanded", "true");
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
  await expect(dialog).toBeHidden();
  await expect(detailsButton).toBeFocused();

  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(activityHeading).toBeFocused();
  await expect(activityHeading).not.toHaveText(firstActivityTitle ?? "");
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
  const emptyUsageSummary = page.getByRole("region", { name: "Consumo de tokens do lote" });
  await emptyUsageSummary.getByRole("button", { name: "Ver consumo e custo estimado do lote" }).hover();
  await expect(emptyUsageSummary.getByText("Nenhum consumo de tokens foi registrado para este lote.")).toBeVisible();
});

test("mantém as decisões acessíveis em tela pequena", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await generateReviewBatch(page);

  const approveButton = page.getByRole("button", { name: "Aprovar" });
  const detailsButton = page.getByRole("button", { name: "Detalhes", exact: true });

  await expect(approveButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejeitar e gerar nova versão" })).toBeVisible();
  await expect(detailsButton).toBeVisible();

  const usageSummary = page.getByRole("region", { name: "Consumo de tokens do lote" });
  const technicalDetailsTrigger = usageSummary.getByRole("button", {
    name: "Ver consumo e custo estimado do lote",
  });
  const technicalDetails = usageSummary.getByRole("tooltip");
  await expect(technicalDetails).toBeHidden();
  await technicalDetailsTrigger.focus();
  await expect(technicalDetails).toBeVisible();
  const technicalDetailsBox = await technicalDetails.boundingBox();
  expect(technicalDetailsBox).not.toBeNull();
  expect(technicalDetailsBox?.x).toBeGreaterThanOrEqual(0);
  expect((technicalDetailsBox?.x ?? 0) + (technicalDetailsBox?.width ?? 0)).toBeLessThanOrEqual(390);
  const widthWithTechnicalDetailsOpen = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(widthWithTechnicalDetailsOpen).toBeLessThanOrEqual(390);

  await detailsButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Detalhes da validação" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detailsButton).toBeFocused();

  await approveButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("article h2")).toBeFocused();

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
});

test("navega sem decidir e retorna ao exemplo sem perder o lote gerado", async ({ page }) => {
  await generateReviewBatch(page);
  const reviewUrl = page.url();
  const activityHeading = page.locator("article h2");
  const firstTitle = await activityHeading.textContent();

  await page.getByRole("button", { name: "Próxima atividade" }).click();
  await expect(page.getByText("Atividade 2 de 3")).toBeVisible();
  await expect(activityHeading).not.toHaveText(firstTitle ?? "");
  await expect(page.getByText("0 de 3 revisadas · 25 min")).toBeVisible();

  const feedback = page.getByRole("textbox", { name: "Feedback opcional" });
  await feedback.fill("Observação ainda não enviada.");
  await page.getByRole("button", { name: "Atividade anterior" }).click();
  await expect(activityHeading).toHaveText(firstTitle ?? "");
  await expect(feedback).toHaveValue("");
  await page.getByRole("button", { name: "Próxima atividade" }).click();
  await expect(feedback).toHaveValue("Observação ainda não enviada.");

  await page.getByRole("link", { name: "Voltar ao exemplo da aula" }).click();
  await expect(page).toHaveURL(/\/planejar\?lote=.*#aula-selecionada/);
  await expect(
    page.getByRole("heading", { name: "Atividades da aula (exemplo)" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voltar às atividades geradas" }).click();
  await expect(page).toHaveURL(reviewUrl);
  await expect(page.getByRole("heading", { name: "Revise o lote" })).toBeVisible();
  await expect(page.getByText("0 de 3 revisadas · 25 min")).toBeVisible();
});
