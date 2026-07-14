import { expect, test } from "@playwright/test";

import { selectFirstLesson } from "./helpers";

test("configura duração, quantidade e distribuição antes da geração", async ({ page }) => {
  await selectFirstLesson(page);

  const durationInput = page.getByRole("spinbutton", { name: "Duração total" });
  const countSelect = page.getByRole("combobox", { name: "Quantidade de atividades" });
  const confirmButton = page.getByRole("button", { name: "Confirmar e gerar atividades" });

  await expect(page.getByRole("heading", { name: "Como será este grupo de atividades?" })).toBeFocused();
  await expect(durationInput).toHaveValue("25");
  await expect(countSelect).toHaveValue("3");
  await expect(page.getByTestId("distribution-total")).toHaveText("Total: 25 min");
  await expect(page.getByRole("listitem").filter({ hasText: "Atividade 1" })).toContainText(
    "9 min",
  );

  await durationInput.fill("4");
  await durationInput.blur();
  await expect(page.getByText("A duração deve ser de pelo menos 5 minutos.")).toBeVisible();
  await expect(confirmButton).toBeDisabled();

  await durationInput.fill("26");
  await countSelect.selectOption("4");
  await expect(page.getByTestId("distribution-total")).toHaveText("Total: 26 min");
  await expect(page.getByRole("listitem").filter({ hasText: "Atividade 1" })).toContainText(
    "7 min",
  );
  await expect(page.getByRole("listitem").filter({ hasText: "Atividade 4" })).toContainText(
    "6 min",
  );

  await confirmButton.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/revisar\?lote=/);
  await expect(page.getByText("0 de 4 revisadas · 26 min")).toBeVisible();
});

test("mantém a configuração utilizável em tela pequena", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await selectFirstLesson(page);

  await expect(page.getByRole("spinbutton", { name: "Duração total" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Quantidade de atividades" })).toBeVisible();

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
});
