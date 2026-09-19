import type {
  Actual,
  ExerciseType,
  PendingSaveRequest,
  Preview,
  SetPosition,
  SetState,
  TrialSet,
  TrialState,
} from "./types";

const emptyActual: Actual = {
  weightKg: null,
  reps: null,
  durationSec: null,
  speedKmh: null,
  inclinePct: null,
};
export const actualFromPlan = (
  type: ExerciseType,
  plan: Preview["exercises"][number]["sets"][number],
): Actual => ({
  weightKg: type === "STRENGTH" ? plan.weightKg : null,
  reps: type === "STRENGTH" ? plan.reps : null,
  durationSec: type === "STRENGTH" ? null : plan.durationSec,
  speedKmh: type === "CARDIO" ? plan.speedKmh : null,
  inclinePct: type === "CARDIO" ? plan.inclinePct : null,
});
export const newTrial = (
  token: string,
  preview: Preview,
  now = Date.now(),
): TrialState => ({
  token,
  preview,
  operationId: "",
  startedAt: 0,
  phase: "preview",
  exercises: preview.exercises.map((exercise) =>
    exercise.sets.map((plan) => ({
      completed: false,
      actual: actualFromPlan(exercise.type, plan),
    })),
  ),
});
export type TrialEvent =
  | { type: "start"; now: number }
  | { type: "actual"; exerciseIndex: number; setIndex: number; actual: Actual }
  | { type: "complete"; exerciseIndex: number; setIndex: number; now: number }
  | { type: "adjustRest"; seconds: number; now: number }
  | {
      type: "skipRest" | "expireRest" | "resume" | "backPreview" | "backActive";
    }
  | { type: "finish"; now: number }
  | { type: "auth" }
  | { type: "cancelAuth" }
  | { type: "saving" }
  | { type: "saved"; routineId: string; workoutId: string }
  | { type: "authError"; message: string }
  | { type: "saveError"; message: string }
  | { type: "clearError" }
  | { type: "replace"; state: TrialState };
export function trialReducer(state: TrialState, event: TrialEvent): TrialState {
  if (event.type === "replace") return event.state;
  if (event.type === "start")
    return state.revoked
      ? { ...state, error: "Ссылка больше недоступна" }
      : {
          ...state,
          operationId: crypto.randomUUID(),
          startedAt: event.now,
          finishedAt: undefined,
          phase: "active",
          error: undefined,
        };
  if (
    state.pendingSaveRequest &&
    ["actual", "complete", "resume", "backPreview", "backActive"].includes(
      event.type,
    )
  )
    return {
      ...state,
      error:
        "Сохранение уже подготовлено: повторите тот же запрос, не меняя результаты",
    };
  if (event.type === "actual")
    return {
      ...updateSet(state, event.exerciseIndex, event.setIndex, (set) => ({
        ...set,
        actual: event.actual,
      })),
      error: undefined,
    };
  if (event.type === "complete") {
    const exercise = state.preview.exercises[event.exerciseIndex];
    const current = state.exercises[event.exerciseIndex]?.[event.setIndex];
    if (!exercise || !current) return { ...state, error: "Подход недоступен" };
    if (!current.completed && !validActual(exercise.type, current.actual))
      return {
        ...state,
        error:
          "Заполните допустимые фактические значения перед отметкой подхода",
      };
    const next = updateSet(
      state,
      event.exerciseIndex,
      event.setIndex,
      (set) => ({
        ...set,
        completed: !set.completed,
        completedAt: !set.completed ? event.now : undefined,
      }),
    );
    const rest = exercise.restSeconds;
    const shouldRest =
      !current.completed && currentPosition(next) !== null && rest > 0;
    return {
      ...next,
      restDeadlineAt: shouldRest ? event.now + rest * 1000 : undefined,
    };
  }
  if (event.type === "adjustRest") {
    if (!state.restDeadlineAt) return state;
    const deadline = state.restDeadlineAt + event.seconds * 1000;
    return {
      ...state,
      restDeadlineAt: deadline > event.now ? deadline : undefined,
    };
  }
  if (event.type === "skipRest" || event.type === "expireRest")
    return { ...state, restDeadlineAt: undefined };
  if (event.type === "finish")
    return completedCount(state)
      ? {
          ...state,
          finishedAt: event.now,
          phase: "summary",
          restDeadlineAt: undefined,
        }
      : { ...state, error: "Завершите хотя бы один подход" };
  if (event.type === "resume" || event.type === "backActive")
    return {
      ...state,
      phase: "active",
      finishedAt: undefined,
      error: undefined,
    };
  if (event.type === "backPreview")
    return {
      ...state,
      phase: "preview",
      restDeadlineAt: undefined,
      error: undefined,
    };
  if (event.type === "auth")
    return {
      ...state,
      phase: "auth",
      pendingSaveRequest: state.pendingSaveRequest ?? pendingBytes(state),
    };
  if (event.type === "cancelAuth") return { ...state, phase: "summary" };
  if (event.type === "saving")
    return { ...state, phase: "saving", error: undefined };
  if (event.type === "saved")
    return {
      ...state,
      phase: "saved",
      saved: { routineId: event.routineId, workoutId: event.workoutId },
    };
  if (event.type === "authError")
    return { ...state, phase: "auth", error: event.message };
  if (event.type === "saveError")
    return { ...state, phase: "summary", error: event.message };
  if (event.type === "clearError") return { ...state, error: undefined };
  return state;
}
function updateSet(
  state: TrialState,
  exerciseIndex: number,
  setIndex: number,
  transform: (set: SetState) => SetState,
) {
  const exercises = state.exercises.map((exercise, e) =>
    exercise.map((set, s) =>
      e === exerciseIndex && s === setIndex ? transform(set) : set,
    ),
  );
  return { ...state, exercises };
}
export function pending(state: TrialState): PendingSaveRequest {
  if (!state.finishedAt) throw new Error("Тренировка ещё не завершена");
  const completedSets: TrialSet[] = state.exercises.flatMap(
    (exercise, exerciseIndex) =>
      exercise.flatMap((set, setIndex) =>
        set.completed && set.completedAt
          ? [
              {
                exerciseIndex,
                setIndex,
                completedAt: set.completedAt,
                ...set.actual,
              },
            ]
          : [],
      ),
  );
  if (!completedSets.length) throw new Error("Завершите хотя бы один подход");
  return {
    operationId: state.operationId,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    completedSets,
  };
}
export const pendingBytes = (state: TrialState) =>
  JSON.stringify(pending(state));
export const completedCount = (state: TrialState) =>
  state.exercises.flat().filter((set) => set.completed).length;
export function currentPosition(state: TrialState): SetPosition | null {
  for (
    let exerciseIndex = 0;
    exerciseIndex < state.exercises.length;
    exerciseIndex += 1
  ) {
    const setIndex = state.exercises[exerciseIndex].findIndex(
      (set) => !set.completed,
    );
    if (setIndex >= 0) return { exerciseIndex, setIndex };
  }
  return null;
}
export function validActual(type: ExerciseType, actual: Actual): boolean {
  const number = (value: number | null, min = 0) =>
    value !== null &&
    Number.isFinite(value) &&
    value >= min &&
    value <= 1_000_000;
  const integer = (value: number | null) =>
    number(value) && Number.isInteger(value);
  return type === "STRENGTH"
    ? number(actual.weightKg) &&
        integer(actual.reps) &&
        actual.durationSec === null &&
        actual.speedKmh === null &&
        actual.inclinePct === null
    : type === "TIMED"
      ? integer(actual.durationSec) &&
        actual.weightKg === null &&
        actual.reps === null &&
        actual.speedKmh === null &&
        actual.inclinePct === null
      : integer(actual.durationSec) &&
        actual.weightKg === null &&
        actual.reps === null &&
        (actual.speedKmh === null || number(actual.speedKmh)) &&
        (actual.inclinePct === null || number(actual.inclinePct, -100));
}
export const remainingRest = (deadline: number | undefined, now: number) =>
  deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
