import { db, lock, channel } from "./db";
import { api, ApiError, authorizedSession } from "./auth";
import {
  asWire,
  capabilities,
  keyOf,
  type LocalRecord,
  type WireRecord,
  type Packet,
} from "./types";
import { merge, eq } from "./merge";
const headers = {
  "X-Gym-Sync-Version": "3",
  "X-Gym-Capabilities": capabilities.join(","),
};
export type Transport = (path: string, init?: RequestInit) => Promise<Response>;
async function checked(response: Response) {
  if (!response.ok)
    throw new ApiError(
      response.status,
      `Синхронизация: ошибка ${response.status}. Изменения сохранены на устройстве.`,
    );
  return response.json();
}
export async function integrate(owner: string, remote: WireRecord[]) {
  for (const incoming of remote) {
    const r = { ...incoming, deleted: incoming.deleted ?? false },
      key = keyOf(owner, r.kind, r.id),
      local = await db.records.get(key);
    if (!local?.dirty) {
      await db.records.put({ ...r, key, owner, dirty: false, baseline: r });
      continue;
    }
    const merged = merge(local.baseline, local, r);
    if (!merged) {
      await db.records.put({ ...local, conflict: r });
      continue;
    }
    await db.records.put({
      ...merged,
      key,
      owner,
      baseline: r,
      dirty: !eq({ ...merged, revision: r.revision }, r),
    });
  }
}
export async function sync(owner: string, transport: Transport = api) {
  if (owner === "guest")
    throw new Error(
      "Гостевой дневник хранится на этом устройстве. Войдите для синхронизации.",
    );
  return lock("journal", () =>
    lock("sync", async () => {
      if (await db.active.get(owner))
        throw new Error(
          "Синхронизация продолжится после завершения тренировки.",
        );
      if (transport === api) {
        const session = await authorizedSession(owner);
        if (session?.userId !== owner)
          throw new Error("Войдите в аккаунт владельца дневника.");
        const token = session.accessToken;
        transport = (path, init = {}) =>
          fetch(`/v1${path}`, {
            ...init,
            credentials: "same-origin",
            cache: "no-store",
            signal: AbortSignal.timeout(20000),
            headers: {
              "Content-Type": "application/json",
              ...init.headers,
              Authorization: `Bearer ${token}`,
            },
          });
      }
      // A persisted packet must be replayed BEFORE pulling or constructing any new packet.
      async function send() {
        const box = await db.outbox.get(owner);
        if (!box) return;
        const response = await transport("/sync", {
          method: "POST",
          headers,
          body: box.body,
        });
        if (response.status === 409) {
          await db.transaction("rw", db.outbox, db.meta, async () => {
            await db.meta.put({
              key: `rejected:${owner}:${JSON.parse(box.body).operationId}`,
              value: box,
            });
            await db.outbox.delete(owner);
          });
          return false;
        } // definite rejection, never an ambiguous network error
        const result = await checked(response);
        await db.transaction("rw", db.records, db.outbox, db.meta, async () => {
          for (const sent of box.sent) {
            const current = await db.records.get(sent.key);
            if (!current) continue;
            const baseline = { ...asWire(sent), revision: result.revision };
            await db.records.put({
              ...current,
              revision: result.revision,
              baseline,
              dirty: !eq(asWire(current), asWire(sent)),
            });
          }
          await db.outbox.delete(owner);
          await db.meta.put({
            key: `revision:${owner}`,
            value: result.revision,
          });
        });
      }
      await send();
      const catalogResponse = await transport("/catalog");
      const catalog = await checked(catalogResponse);
      await db.transaction("rw", db.catalog, db.meta, async () => {
        for (const r of [...catalog.records, ...catalog.equipment])
          await db.catalog.put({ ...r, key: `${r.kind}:${r.id}` });
        await db.meta.put({ key: "catalogRevision", value: catalog.revision });
      });
      const response = await transport("/sync", { headers });
      const snapshot = await checked(response);
      const accepted = (response.headers.get("X-Gym-Capabilities") ?? "")
        .split(",")
        .map((x) => x.trim());
      if (!capabilities.every((c) => accepted.includes(c)))
        throw new Error(
          "Сервер не поддерживает необходимые возможности веб-клиента. Отправка остановлена.",
        );
      await db.transaction("rw", db.records, db.meta, async () => {
        await integrate(owner, snapshot.records);
        await db.meta.put({
          key: `revision:${owner}`,
          value: snapshot.revision,
        });
      });
      const dirty = (
        await db.records.where("owner").equals(owner).toArray()
      ).filter((r) => r.dirty && !r.conflict);
      if (dirty.length) {
        const packet: Packet = {
          operationId: crypto.randomUUID(),
          catalogRevision: catalog.revision,
          changes: dirty.map((r) => ({
            kind: r.kind,
            id: r.id,
            baseRevision: r.baseline?.revision ?? 0,
            deleted: r.deleted,
            payload: r.payload,
          })),
        };
        await db.outbox.put({
          owner,
          body: JSON.stringify(packet),
          sent: dirty,
        });
        if ((await send()) === false)
          throw new Error(
            "Данные на сервере изменились. Повторите синхронизацию для согласования версий.",
          );
      }
      await db.meta.put({ key: `lastSync:${owner}`, value: Date.now() });
      channel?.postMessage({ type: "synced", owner });
    }),
  );
}
export async function resolveConflict(
  record: LocalRecord,
  choice: "local" | "remote",
) {
  await lock("journal", () =>
    db.transaction("rw", db.records, async () => {
      const fresh = await db.records.get(record.key);
      if (!fresh?.conflict) return;
      const remote = fresh.conflict;
      await db.records.put({
        ...fresh,
        ...(choice === "remote" ? remote : {}),
        revision: remote.revision,
        baseline: remote,
        dirty: choice === "local",
        conflict: undefined,
      });
    }),
  );
}
