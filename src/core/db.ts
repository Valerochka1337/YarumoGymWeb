import Dexie, { type Table } from "dexie";
import type {
  LocalRecord,
  Outbox,
  CatalogRecord,
  Active,
  Payload,
} from "./types";
import { keyOf } from "./types";
export class JournalDB extends Dexie {
  records!: Table<LocalRecord, string>;
  outbox!: Table<Outbox, string>;
  catalog!: Table<CatalogRecord, string>;
  active!: Table<Active, string>;
  meta!: Table<{ key: string; value: any }, string>;
  constructor(name = "yarumo-journal") {
    super(name);
    this.version(1).stores({
      records: "key,owner,[owner+kind]",
      outbox: "owner",
      catalog: "key,kind",
      active: "owner",
      meta: "key",
    });
  }
}
export const db = new JournalDB();
export const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("yarumo-events")
    : null;
export async function save(
  owner: string,
  kind: string,
  id: string,
  payload: Payload | null,
  deleted = false,
) {
  await db.transaction("rw", db.records, async () => {
    const key = keyOf(owner, kind, id),
      old = await db.records.get(key);
    if (old?.conflict)
      throw new Error("Сначала разрешите конфликт этой записи в профиле.");
    await db.records.put({
      ...old,
      key,
      owner,
      kind,
      id,
      revision: old?.revision ?? 0,
      baseline: old?.baseline ?? null,
      dirty: true,
      deleted,
      payload,
    });
  });
  channel?.postMessage({ type: "changed", owner });
}
export async function records(owner: string, kind: string) {
  return (
    await db.records.where("[owner+kind]").equals([owner, kind]).toArray()
  ).filter((r) => !r.deleted);
}
export async function guardedDelete(owner: string, kind: string, id: string) {
  const all = await db.records.where("owner").equals(owner).toArray();
  if (
    all.some(
      (r) =>
        !r.deleted && r.id !== id && JSON.stringify(r.payload).includes(id),
    )
  )
    throw new Error(
      "Запись используется в дневнике. Сначала удалите связанные записи или измените ссылки.",
    );
  await save(owner, kind, id, null, true);
}
export async function lock<T>(name: string, run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request(`yarumo:${name}`, run);
  throw new Error(
    "Для безопасной работы между вкладками нужен браузер с поддержкой Web Locks.",
  );
}
