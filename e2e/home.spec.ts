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
