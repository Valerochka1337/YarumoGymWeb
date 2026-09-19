import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TrialApp } from "./TrialApp";

beforeEach(() => {
  localStorage.clear();
  history.replaceState(
    null,
    "",
    "/r/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            title: "Пресс",
            estimatedDurationSeconds: 60,
            exercises: [
              {
                exerciseKey: "press",
                name: "Жим",
                type: "STRENGTH",
                restSeconds: 30,
                sets: [
                  {
                    weightKg: 20,
                    reps: 8,
                    durationSec: null,
                    speedKmh: null,
                    inclinePct: null,
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("renders immutable preview and defers auth until saving", async () => {
  render(<TrialApp />);
  expect(
    await screen.findByRole("button", { name: "Начать тренировку" }),
  ).toBeEnabled();
  expect(screen.queryByText("Сохранить результаты")).not.toBeInTheDocument();
});
it("shows unavailable for a missing preview and offers retry for transient failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "gone" }), { status: 404 }),
      ),
  );
  render(<TrialApp />);
  expect(await screen.findByText("Ссылка недоступна")).toBeVisible();
});
it("guides the workout through current sets with progress and rest timer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: "Ноги легко",
          estimatedDurationSeconds: 900,
          exercises: [
            {
              exerciseKey: "squat",
              name: "Гакк-приседания",
              type: "STRENGTH",
              restSeconds: 30,
              sets: [
                {
                  weightKg: 20,
                  reps: 8,
                  durationSec: null,
                  speedKmh: null,
                  inclinePct: null,
                },
                {
                  weightKg: 25,
                  reps: 6,
                  durationSec: null,
                  speedKmh: null,
                  inclinePct: null,
                },
              ],
            },
            {
              exerciseKey: "plank",
              name: "Планка",
              type: "TIMED",
              restSeconds: 20,
              sets: [
                {
                  weightKg: null,
                  reps: null,
                  durationSec: 45,
                  speedKmh: null,
                  inclinePct: null,
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    ),
  );
  render(<TrialApp />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Начать тренировку" }),
  );
  expect(screen.getByText("00:00")).toBeVisible();
  expect(screen.getByText("упражнение 1 из 2")).toBeVisible();
  expect(screen.getByText("0/3 подходов")).toBeVisible();
  expect(screen.getByLabelText("кг")).toHaveValue(20);
  fireEvent.click(screen.getByRole("button", { name: "Подход выполнен" }));
  expect(await screen.findByText("1/3 подходов")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Пропустить отдых" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Пропустить отдых" }));
  expect(screen.getByLabelText("кг")).toHaveValue(25);
});
