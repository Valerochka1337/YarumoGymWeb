import { db, lock } from "./db";
import { keyOf, type Payload, type LocalRecord } from "./types";
export const emptySet = (index = 0) => ({
  setIndex: index,
  weightKg: null,
  reps: null,
  durationSec: null,
  speedKmh: null,
  inclinePct: null,
  isCompleted: false,
  completedAt: null,
});
export async function startWorkout(owner: string, routine?: LocalRecord) {
  return lock("journal", () =>
    db.transaction("rw", db.records, db.active, async () => {
      const active = await db.active.get(owner);
      if (active) return active.workoutId;
      const id = crypto.randomUUID();
      const payload = {
        name: routine?.payload?.name ?? "Свободная тренировка",
        note: "",
        routineId: routine?.id ?? null,
        startedAt: Date.now(),
        finishedAt: null,
        gymIds: routine?.payload?.gymIds ?? [],
        exercises: (routine?.payload?.exercises ?? []).map(
          (r: Payload, i: number) => ({
            sectionId: crypto.randomUUID(),
            exerciseId: r.exerciseId,
            position: i,
            sets: r.plannedSets.map((s: Payload, j: number) => ({
              ...emptySet(j),
              ...s,
            })),
          }),
        ),
      };
      await db.records.put({
        key: keyOf(owner, "workout", id),
        kind: "workout",
        id,
        owner,
        revision: 0,
        baseline: null,
        dirty: true,
        deleted: false,
        payload,
      });
      await db.active.put({ owner, workoutId: id, restEndsAt: null });
      return id;
    }),
  );
}
export async function changeWorkout(
  owner: string,
  id: string,
  change: (payload: Payload) => void,
  rest?: number | null,
) {
  await lock("journal", () =>
    db.transaction("rw", db.records, db.active, async () => {
      const key = keyOf(owner, "workout", id),
        record = await db.records.get(key);
      if (!record?.payload) throw new Error("Тренировка не найдена");
      if (record.conflict)
        throw new Error("Разрешите конфликт перед редактированием");
      const active = await db.active.get(owner);
      if (!record.payload.finishedAt && active?.workoutId !== id)
        throw new Error("Тренировка уже завершена в другой вкладке");
      const payload = structuredClone(record.payload);
      change(payload);
      await db.records.put({ ...record, payload, dirty: true });
      if (payload.finishedAt) await db.active.delete(owner);
      else if (rest !== undefined)
        await db.active.update(owner, {
          restEndsAt: rest === null ? null : Date.now() + rest * 1000,
        });
    }),
  );
}
export function volume(
  workout: Payload,
  exerciseTypes: Map<string, string>,
): number {
  return (workout.exercises ?? [])
    .filter((r: Payload) => exerciseTypes.get(r.exerciseId) === "STRENGTH")
    .flatMap((r: Payload) => r.sets)
    .filter(
      (s: Payload) => s.isCompleted && s.weightKg != null && s.reps != null,
    )
    .reduce((sum: number, s: Payload) => sum + s.weightKg * s.reps, 0);
}
