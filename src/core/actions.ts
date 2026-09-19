import { db, lock } from "./db";
import { apiJson, currentSession } from "./auth";
import { sync } from "./sync";
export async function freshContext(owner: string) {
  await sync(owner);
  const dirty = (await db.records.where("owner").equals(owner).toArray()).some(
    (r) => r.dirty || r.conflict,
  );
  if (dirty || (await db.outbox.get(owner)))
    throw new Error("Сначала синхронизируйте изменения и разрешите конфликты.");
  return {
    expectedRevision: (await db.meta.get(`revision:${owner}`))?.value ?? 0,
    expectedCatalogRevision: (await db.meta.get("catalogRevision"))?.value ?? 0,
  };
}
/** Persist approval bytes before the request. Only the explicit retry button replays them. */
export async function approveProposal(owner: string, proposal: any) {
  if (currentSession()?.userId !== owner)
    throw new Error("Войдите в аккаунт владельца");
  if (await db.active.get(owner))
    throw new Error("Сначала завершите тренировку");
  await lock("proposal", async () => {
    const key = `proposal:${owner}`,
      pending = await db.meta.get(key);
    if (pending)
      throw new Error("Сначала повторите незавершённое подтверждение.");
    const body = JSON.stringify({
      operationId: crypto.randomUUID(),
      version: proposal.currentVersion,
      draft: proposal.snapshot.draft,
    });
    await db.meta.put({
      key,
      value: { proposalId: proposal.proposalId, body },
    });
    await retryApproval(owner);
  });
}
export async function retryApproval(owner: string) {
  const key = `proposal:${owner}`,
    pending = await db.meta.get(key);
  if (!pending) return;
  if (currentSession()?.userId !== owner)
    throw new Error("Войдите в аккаунт владельца");
  if (await db.active.get(owner))
    throw new Error("Сначала завершите тренировку");
  await apiJson(`/training-proposals/${pending.value.proposalId}/approve`, {
    method: "POST",
    headers: { "X-Gym-Capabilities": "calendar-plans" },
    body: pending.value.body,
  });
  await db.meta.delete(key);
  await sync(owner);
}
