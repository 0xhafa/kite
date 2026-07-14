import { expect, test } from "@playwright/test";

test("exibe a página inicial e a identidade do Kite", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Atividades claras, leves e prontas para revisar." }),
  ).toBeVisible();
  await expect(page.getByRole("img", { exact: true, name: "Kite" })).toBeVisible();
  await expect(
    page.getByText("Você aprova, rejeita ou gera uma nova versão de cada proposta."),
  ).toBeVisible();
  await expect(page.getByText("Nenhum lote gerado ainda")).toBeVisible();
});

test("mantém o início utilizável em tela pequena", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Começar planejamento" })).toBeVisible();

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
});
