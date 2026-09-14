import { beforeEach, describe, it, expect } from "vitest";
import { db, save, records } from "../src/core/db";
import { merge } from "../src/core/merge";
import { sync, integrate } from "../src/core/sync";
import {
  volume,
  startWorkout,
  changeWorkout,
  emptySet,
} from "../src/core/workout";
import { resolveTime } from "../src/core/calendar";
import { capabilities, type WireRecord } from "../src/core/types";
import fixture from "./fixtures/android-snapshot.json";
const rec = (payload: any, revision = 1): WireRecord => ({
  id: "id",
  kind: "routine",
  revision,
  deleted: false,
  payload,
});
beforeEach(async () => {
  await Promise.all([
    db.records.clear(),
    db.outbox.clear(),
    db.active.clear(),
    db.meta.clear(),
    db.catalog.clear(),
  ]);
});
describe("three-way merge", () => {
  it("merges disjoint fields", () =>
    expect(
      merge(
        rec({ name: "A", note: "" }),
        rec({ name: "B", note: "" }),
        rec({ name: "A", note: "remote" }, 2),
      )?.payload,
    ).toEqual({ name: "B", note: "remote" }));
  it("preserves overlapping array versions as a conflict", () =>
    expect(
      merge(
        rec({ exercises: [1] }),
        rec({ exercises: [2] }),
        rec({ exercises: [3] }, 2),
      ),
    ).toBeNull());
  it("does not discard edits on remote deletion", () =>
    expect(
      merge(rec({ name: "A" }), rec({ name: "B" }), {
        ...rec(null, 2),
        deleted: true,
      }),
    ).toBeNull());
});
it("imports and preserves exact Android aggregates including unknown fields", async () => {
  const rows = fixture.records.map((r) => ({ ...r, deleted: false }));
  await db.transaction("rw", db.records, () => integrate("a", rows));
  const local = await records("a", "workout");
  expect(local[0].payload).toEqual(rows[1].payload);
  expect(volume(local[0].payload!, new Map([[rows[0].id, "STRENGTH"]]))).toBe(
    380,
  );
  expect(await records("b", "workout")).toEqual([]);
});
it("persists a completed set and rest deadline across reopening IndexedDB", async () => {
  const id = await startWorkout("guest");
  await changeWorkout(
    "guest",
    id,
    (p) =>
      p.exercises.push({
        exerciseId: "e",
        sectionId: "s",
        position: 0,
        sets: [{ ...emptySet(), weightKg: 25, reps: 8, isCompleted: true }],
      }),
    90,
  );
  db.close();
  await db.open();
  expect(
    (await records("guest", "workout"))[0].payload!.exercises[0].sets[0].reps,
  ).toBe(8);
  expect((await db.active.get("guest"))!.restEndsAt).toBeGreaterThan(
    Date.now(),
  );
  await changeWorkout("guest", id, (p) => {
    p.finishedAt = Date.now();
  });
  expect(await db.active.get("guest")).toBeUndefined();
});
it("replays identical bytes after a lost acknowledgement", async () => {
  await save("a", "routine", "id", { name: "A" });
  const bodies: string[] = [];
  let fail = true;
  const transport = async (path: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      bodies.push(String(init.body));
      if (fail) {
        fail = false;
        throw new Error("network");
      }
      return Response.json({ revision: 2 });
    }
    if (path === "/catalog")
      return Response.json({ revision: 1, records: [], equipment: [] });
    return Response.json(
      { revision: 1, records: [] },
      { headers: { "X-Gym-Capabilities": capabilities.join(",") } },
    );
  };
  await expect(sync("a", transport)).rejects.toThrow("network");
  expect(await db.outbox.get("a")).toBeDefined();
  await sync("a", transport);
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
  expect(await db.outbox.get("a")).toBeUndefined();
});
it("retains both conflicting versions and never sends the conflict", async () => {
  await db.transaction("rw", db.records, () =>
    integrate("a", [rec({ name: "A" })]),
  );
  await save("a", "routine", "id", { name: "Local" });
  await db.transaction("rw", db.records, () =>
    integrate("a", [rec({ name: "Remote" }, 2)]),
  );
  const r = (await records("a", "routine"))[0];
  expect(r.payload!.name).toBe("Local");
  expect(r.conflict!.payload!.name).toBe("Remote");
});
it("does not sync an active workout", async () => {
  await startWorkout("a");
  await expect(
    sync("a", async () => {
      throw new Error("should not call");
    }),
  ).rejects.toThrow("завершения");
});
it("matches Android spring DST gap and earlier autumn overlap", () => {
  expect(
    new Date(resolveTime("2026-03-29", "02:30", "Europe/Berlin")).toISOString(),
  ).toBe("2026-03-29T01:00:00.000Z");
  expect(
    new Date(resolveTime("2026-10-25", "02:30", "Europe/Berlin")).toISOString(),
  ).toBe("2026-10-25T00:30:00.000Z");
});
import { profileId, exceptionId } from "../src/core/identity";
import profileFixture from "./fixtures/basic-profile-sync-contract.json";
it("uses the exact Android profile UUID", () =>
  expect(profileId(profileFixture.identity.owner)).toBe(
    profileFixture.identity.expectedUuid,
  ));
it("retains edits made while the previous packet awaits acknowledgement", async () => {
  await save("a", "routine", "id", { name: "A" });
  let posts = 0;
  const transport = async (path: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts++;
      if (posts === 1) {
        await save("a", "routine", "id", { name: "B" });
        throw new Error("lost reply");
      }
      return Response.json({ revision: 2 });
    }
    if (path === "/catalog")
      return Response.json({ revision: 1, records: [], equipment: [] });
    return Response.json(
      { revision: 2, records: posts ? [rec({ name: "A" }, 2)] : [] },
      { headers: { "X-Gym-Capabilities": capabilities.join(",") } },
    );
  };
  await expect(sync("a", transport)).rejects.toThrow();
  await sync("a", transport);
  expect((await records("a", "routine"))[0].payload!.name).toBe("B");
  expect(posts).toBe(3);
});
it("does not interpret missing capability records as deletions", async () => {
  await db.transaction("rw", db.records, () =>
    integrate("a", [rec({ name: "kept" })]),
  );
  await db.transaction("rw", db.records, () => integrate("a", []));
  expect((await records("a", "routine"))[0].payload!.name).toBe("kept");
});
