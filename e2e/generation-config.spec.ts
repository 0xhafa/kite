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

  const settingsButton = page.getByRole("button", { name: "Abrir configurações" });
  await settingsButton.hover();
  await expect(page.getByRole("tooltip", { name: "Configurações" })).toBeVisible();
  await settingsButton.click();
  const settings = page.getByRole("dialog", { name: "Configurações" });
  const providerSelect = settings.getByRole("combobox", { name: "Provedor" });
  const modelSelect = settings.getByRole("combobox", { name: "Modelo" });
  const effortSelect = settings.getByRole("combobox", { name: "Esforço de raciocínio" });
  await expect(providerSelect.locator("option")).toHaveCount(3);
  await expect(providerSelect).toHaveValue("openai");
  await expect(modelSelect).toHaveValue("gpt-5.6-sol");
  await expect(effortSelect).toHaveValue("medium");

  await settings.getByRole("button", { name: "Informações sobre o modelo selecionado" }).focus();
  await expect(
    settings.getByRole("tooltip", { name: /Maior capacidade para comparar a qualidade máxima/ }),
  ).toBeVisible();
  await settings.getByRole("button", { name: "Informações sobre o esforço de raciocínio" }).focus();
  await expect(
    settings.getByRole("tooltip", { name: /Mais esforço pode melhorar tarefas difíceis/ }),
  ).toBeVisible();

  await providerSelect.selectOption("gemini");
  await expect(modelSelect).toHaveValue("gemini-3.5-flash");
  await expect(effortSelect).toHaveValue("medium");
  await settings.getByRole("button", { name: "Informações sobre o modelo selecionado" }).focus();
  await expect(
    settings.getByRole("tooltip", { name: /Gratuito dentro da cota do Gemini API/ }),
  ).toBeVisible();

  await providerSelect.selectOption("groq");
  await expect(modelSelect).toHaveValue("qwen/qwen3.6-27b");
  await expect(effortSelect).toHaveValue("default");
  await effortSelect.selectOption("none");
  await expect(effortSelect).toHaveValue("none");

  await providerSelect.selectOption("openai");
  await modelSelect.selectOption("gpt-4.1-mini");
  await expect(effortSelect).toBeDisabled();
  await expect(effortSelect).toHaveValue("not-applicable");
  await modelSelect.selectOption("gpt-5.6-terra");
  await effortSelect.selectOption("low");
  await expect(effortSelect).toHaveValue("low");
  await settings.getByRole("button", { name: "Concluir" }).click();
  await expect(settings).not.toBeVisible();
  await expect(durationInput).toHaveValue("26");
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
