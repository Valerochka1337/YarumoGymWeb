import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TrialApp } from "./TrialApp";

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/r/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ title:"Пресс",estimatedDurationSeconds:60,exercises:[] }), { status:200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("renders immutable preview and defers auth until saving", async () => {
  render(<TrialApp />);
  expect(await screen.findByRole("button", { name:"Начать тренировку" })).toBeEnabled();
  expect(screen.queryByText("Сохранить результаты")).not.toBeInTheDocument();
});
it("shows unavailable for a missing preview and offers retry for transient failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ message:"gone" }), { status:404 })));
  render(<TrialApp />);
  expect(await screen.findByText("Ссылка недоступна")).toBeVisible();
});
