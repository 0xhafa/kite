import { expect, test } from "@playwright/test";

test("exibe os primitivos e os estados acessíveis", async ({ page }) => {
  await page.goto("/design");

  await expect(page.getByRole("heading", { level: 1, name: "Design do Kite" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar atividades" })).toBeVisible();
  await expect(page.getByText("Aprovada", { exact: true })).toBeVisible();

  const progress = page.getByRole("progressbar", { name: "Duração planejada" });
  await expect(progress).toHaveAttribute("aria-valuenow", "20");
  await expect(progress).toHaveAttribute("aria-valuemax", "25");
});

test("mantém o foco no modal, fecha com Escape e restaura o foco", async ({ page }) => {
  await page.goto("/design");

  const trigger = page.getByRole("button", { name: "Abrir exemplo" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Relatório de validação" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar modal" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Entendi" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
