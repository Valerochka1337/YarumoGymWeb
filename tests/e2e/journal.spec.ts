import { test, expect } from "@playwright/test";
test("guest diary survives reload, completion and calendar planning", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Время для себя" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Каталог", exact: true }).click();
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await page.getByRole("textbox", { name: "Название" }).fill("Приседания");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/routines");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await page.getByRole("textbox", { name: "Название" }).fill("Ноги");
  await page.getByLabel("Приседания").check();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Вес 1.1", exact: true })
    .fill("40");
  await page
    .getByRole("spinbutton", { name: "Повторы 1.1", exact: true })
    .fill("8");
  await page
    .getByRole("button", { name: "Выполнен подход 1.1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Выполнен подход 1.1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: "Вес 1.1", exact: true }),
  ).toHaveValue("40");
  await expect(
    page.getByRole("spinbutton", { name: "Повторы 1.1", exact: true }),
  ).toHaveValue("8");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await expect(page.getByText("ЗАВЕРШЕНА", { exact: true })).toBeVisible();
  await page.goto("/analysis");
  await expect(page.getByText("320", { exact: true }).first()).toBeVisible();
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Запланировать", exact: true })
    .click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ноги", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/calendar-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("only one tab edits an active workout", async ({ page, context }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Начать тренировку", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Завершить", exact: true }),
  ).toBeEnabled();
  const second = await context.newPage();
  await second.goto(page.url());
  await expect(
    second.getByRole("button", { name: "Завершить", exact: true }),
  ).toBeDisabled();
  await page.close();
  await second.reload();
  await expect(
    second.getByRole("button", { name: "Завершить", exact: true }),
  ).toBeEnabled();
});
test("production PWA shell restarts offline", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "Playwright WebKit does not expose service workers; real iPhone acceptance remains required.",
  );
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Время для себя" }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Время для себя" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Начать тренировку", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Свободная тренировка", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});
