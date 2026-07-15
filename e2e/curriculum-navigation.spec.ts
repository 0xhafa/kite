import { expect, test } from "@playwright/test";

test("percorre o currículo por teclado e só libera uma aula concreta", async ({ page }) => {
  await page.goto("/planejar");

  const advanceButton = page.getByRole("button", { name: "Avançar para configuração" });
  await expect(advanceButton).toBeDisabled();
  await expect(page.getByText("Nenhuma aula selecionada")).toBeVisible();

  const themeButton = page
    .getByRole("group", { name: "1. Tema" })
    .getByRole("button", { name: "Fonemas" });
  await themeButton.focus();
  await page.keyboard.press("Enter");
  await expect(themeButton).toHaveAttribute("aria-pressed", "true");

  const skillButton = page
    .getByRole("group", { name: "2. Habilidade" })
    .getByRole("button")
    .first();
  await skillButton.focus();
  await page.keyboard.press("Enter");

  const objectiveButton = page
    .getByRole("group", { name: "3. Objetivo" })
    .getByRole("button")
    .first();
  await objectiveButton.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("group", { name: "4. Semana" })).toHaveCount(0);

  const lessonButton = page
    .getByRole("group", { name: "4. Aula" })
    .getByRole("button", { name: /Aula 1/ })
    .first();
  await lessonButton.focus();
  await page.keyboard.press("Enter");

  await expect(lessonButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Objetivo específico" })).toBeVisible();
  await expect(page.getByText("Escuta e produção do fonema /f/.", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("Música: A Formiga", { exact: false })).toBeVisible();
  await expect(advanceButton).toBeEnabled();
});

test("mantém a seleção curricular utilizável em tela pequena", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/planejar");

  await expect(page.getByRole("heading", { name: "Qual aula você quer planejar?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fonemas" })).toBeVisible();

  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(390);
});
