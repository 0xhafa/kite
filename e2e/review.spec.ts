import { expect, test } from "@playwright/test";

test("revisa uma atividade principal por vez e exibe o progresso do lote", async ({ page }) => {
  await page.goto("/revisar");

  await expect(page.getByRole("heading", { name: "Olhar de investigador" })).toBeFocused();
  await expect(page.getByText("Atividade 1 de 3")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(1);
  await expect(page.getByText("9 min", { exact: true })).toBeVisible();
  await expect(page.getByText("Validação aprovada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejeitar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Detalhes" })).toBeVisible();

  const progress = page.getByRole("progressbar", { name: "Progresso da revisão" });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await expect(progress).toHaveAttribute("aria-valuemax", "3");

  await page.getByRole("button", { name: "Detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: "Detalhes da validação" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Critério acao-observavel")).toBeVisible();
  await expect(dialog.getByText("Atendido", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Detalhes" })).toBeFocused();

  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByRole("heading", { name: "Ouvidos atentos" })).toBeFocused();
  await expect(page.getByText("Atividade 2 de 3")).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByText("Aprovadas").locator("..")).toContainText("1");

  await page.getByRole("button", { name: "Rejeitar" }).click();
  await expect(page.getByRole("heading", { name: "Aponte a pista" })).toBeFocused();
  await expect(progress).toHaveAttribute("aria-valuenow", "2");

  await page.getByRole("button", { name: "Aprovar" }).click();
  await expect(page.getByRole("heading", { name: "Lote revisado" })).toBeFocused();
  await expect(page.getByText("2 aprovadas e 1 rejeitada")).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "3");
});

test("exibe estados de carregamento, erro e vazio", async ({ page }) => {
  await page.goto("/revisar?estado=carregando");
  await expect(page.getByRole("status")).toContainText("Preparando atividades para revisão");

  await page.goto("/revisar?estado=erro");
  await expect(
    page.getByRole("alert", { name: "Não foi possível abrir a revisão" }),
  ).toContainText("Não foi possível abrir a revisão");

  await page.goto("/revisar?estado=vazio");
  await expect(page.getByRole("status")).toContainText("Nenhuma atividade para revisar");
});

test("mantém as decisões acessíveis em tela pequena", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/revisar");

  await expect(page.getByRole("button", { name: "Aprovar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rejeitar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Detalhes" })).toBeVisible();

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
});
