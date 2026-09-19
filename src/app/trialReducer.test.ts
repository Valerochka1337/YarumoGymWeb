import { describe, expect, it } from "vitest";
import {
  currentPosition,
  newTrial,
  pending,
  remainingRest,
  trialReducer,
} from "./trialReducer";
import type { Preview } from "./types";
const preview: Preview = {
  title: "Test",
  estimatedDurationSeconds: 60,
  exercises: [
    {
      exerciseKey: "x",
      name: "Press",
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
};
describe("trial reducer", () => {
  it("starts only on explicit action and keeps plan immutable", () => {
    let state = newTrial("a".repeat(43), preview, 100);
    expect(state.startedAt).toBe(0);
    state = trialReducer(state, { type: "start", now: 150 });
    expect(state.startedAt).toBe(150);
    state = trialReducer(state, {
      type: "actual",
      exerciseIndex: 0,
      setIndex: 0,
      actual: {
        weightKg: 25,
        reps: 9,
        durationSec: null,
        speedKmh: null,
        inclinePct: null,
      },
    });
    state = trialReducer(state, {
      type: "complete",
      exerciseIndex: 0,
      setIndex: 0,
      now: 200,
    });
    expect(state.preview.exercises[0].sets[0].weightKg).toBe(20);
    expect(remainingRest(state.restDeadlineAt, 1000)).toBe(0);
    state = trialReducer(state, { type: "finish", now: 2000 });
    expect(pending(state).completedSets).toHaveLength(1);
  });
});
it("initializes visible planned facts and blocks zero or invalid completion", () => {
  let state = newTrial("a".repeat(43), preview, 100);
  state = trialReducer(state, { type: "start", now: 100 });
  expect(state.exercises[0][0].actual).toMatchObject({ weightKg: 20, reps: 8 });
  state = trialReducer(state, {
    type: "complete",
    exerciseIndex: 0,
    setIndex: 0,
    now: 200,
  });
  expect(state.exercises[0][0].completed).toBe(true);
  state = trialReducer(state, {
    type: "complete",
    exerciseIndex: 0,
    setIndex: 0,
    now: 300,
  });
  expect(state.restDeadlineAt).toBeUndefined();
  state = trialReducer(newTrial("b".repeat(43), preview, 100), {
    type: "finish",
    now: 200,
  });
  expect(state.phase).toBe("preview");
  expect(state.error).toMatch(/хотя бы один/);
});
it("advances focus and lets the rest pill adjust its deadline", () => {
  const twoSets: Preview = {
    ...preview,
    exercises: [
      {
        ...preview.exercises[0],
        sets: [
          ...preview.exercises[0].sets,
          { ...preview.exercises[0].sets[0], weightKg: 25 },
        ],
      },
    ],
  };
  let state = trialReducer(newTrial("c".repeat(43), twoSets), {
    type: "start",
    now: 1_000,
  });
  expect(currentPosition(state)).toEqual({ exerciseIndex: 0, setIndex: 0 });
  state = trialReducer(state, {
    type: "complete",
    exerciseIndex: 0,
    setIndex: 0,
    now: 2_000,
  });
  expect(currentPosition(state)).toEqual({ exerciseIndex: 0, setIndex: 1 });
  expect(remainingRest(state.restDeadlineAt, 2_000)).toBe(30);
  state = trialReducer(state, { type: "adjustRest", seconds: 15, now: 2_000 });
  expect(remainingRest(state.restDeadlineAt, 2_000)).toBe(45);
  state = trialReducer(state, { type: "adjustRest", seconds: -60, now: 2_000 });
  expect(state.restDeadlineAt).toBeUndefined();
});
