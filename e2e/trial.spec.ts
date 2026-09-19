import { test, expect } from "@playwright/test";

test("mobile browser workout advances through sets and exposes the rest timer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/v1/routine-shares/preview/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        title: "Ноги легко",
        estimatedDurationSeconds: 900,
        exercises: [
          {
            exerciseKey: "leg-curl",
            name: "Сгибание ног",
            type: "STRENGTH",
            restSeconds: 30,
            sets: [
              {
                weightKg: 20,
                reps: 10,
                durationSec: null,
                speedKmh: null,
                inclinePct: null,
              },
              {
                weightKg: 25,
                reps: 8,
                durationSec: null,
                speedKmh: null,
                inclinePct: null,
              },
            ],
          },
        ],
      }),
    }),
  );
  await page.goto("/r/ccccccccccccccccccccccccccccccccccccccccccc");
  await page.getByRole("button", { name: "Начать тренировку" }).click();
  await expect(page.getByText("0/2 подходов")).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "кг" })).toHaveValue("20");
  await page.getByRole("button", { name: "Подход выполнен" }).click();
  await expect(page.getByText("1/2 подходов")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Пропустить отдых" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пропустить отдых" }).click();
  await expect(page.getByRole("spinbutton", { name: "кг" })).toHaveValue("25");
});

test.describe("service-worker rollout scaffolding", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName === "webkit",
      "Playwright WebKit does not expose service workers; physical iPhone acceptance remains required.",
    );
  });

  test("controlled worker leaves token and API routes on the network", async ({
    page,
  }) => {
    let previewRequests = 0;
    await page.route("**/v1/routine-shares/preview/**", (route) => {
      previewRequests += 1;
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: '{"code":"share_unavailable"}',
      });
    });
    await page.setViewportSize({ width: 320, height: 700 });

    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);

    await page.goto("/r/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    await expect(
      page.getByRole("heading", { name: "Ссылка недоступна" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Ссылка недоступна" }),
    ).toBeVisible();
    expect(previewRequests).toBe(2);

    const cachedUrls = await page.evaluate(async () => {
      const names = await caches.keys();
      const requests = await Promise.all(
        names.map(async (name) => (await caches.open(name)).keys()),
      );
      return requests.flat().map((request) => new URL(request.url).pathname);
    });
    expect(
      cachedUrls.some(
        (path) => path.startsWith("/r/") || path.startsWith("/v1/"),
      ),
    ).toBe(false);
  });

  test("controlled worker reaches an active browser trial", async ({
    page,
  }) => {
    await page.route("**/v1/routine-shares/preview/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: "Ноги легко",
          estimatedDurationSeconds: 900,
          exercises: [
            {
              exerciseKey: "leg-curl",
              name: "Сгибание ног",
              type: "STRENGTH",
              restSeconds: 30,
              sets: [
                {
                  weightKg: 20,
                  reps: 10,
                  durationSec: null,
                  speedKmh: null,
                  inclinePct: null,
                },
                {
                  weightKg: 25,
                  reps: 8,
                  durationSec: null,
                  speedKmh: null,
                  inclinePct: null,
                },
              ],
            },
          ],
        }),
      }),
    );

    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);

    await page.goto("/r/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    await expect(
      page.getByRole("heading", { name: "Ноги легко" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Начать тренировку" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Начать тренировку" }).click();
    await expect(page.getByText("0/2 подходов")).toBeVisible();
    await expect(page.getByText("упражнение 1 из 1")).toBeVisible();
    await page.getByRole("button", { name: "Подход выполнен" }).click();
    await expect(page.getByText("1/2 подходов")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Пропустить отдых" }),
    ).toBeVisible();
  });
});
