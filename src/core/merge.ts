import type { WireRecord } from "./types";
const eq = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak = Object.keys(a),
    bk = Object.keys(b);
  return (
    ak.length === bk.length &&
    ak.every((k) => Object.hasOwn(b, k) && eq((a as any)[k], (b as any)[k]))
  );
};
export { eq };
export function merge(
  base: WireRecord | null,
  local: WireRecord,
  remote: WireRecord,
): WireRecord | null {
  const state = (r: WireRecord | null) =>
    r ? { deleted: r.deleted, payload: r.payload } : undefined;
  if (eq(state(local), state(remote))) return remote;
  if (eq(state(base), state(local))) return remote;
  if (eq(state(base), state(remote)))
    return { ...local, revision: remote.revision };
  if (!base || local.deleted || remote.deleted) return null;
  const result: Record<string, unknown> = {};
  for (const k of new Set([
    ...Object.keys(base.payload ?? {}),
    ...Object.keys(local.payload ?? {}),
    ...Object.keys(remote.payload ?? {}),
  ])) {
    const b = base.payload?.[k],
      l = local.payload?.[k],
      r = remote.payload?.[k];
    if (eq(l, r) || eq(b, l)) {
      if (r !== undefined) result[k] = r;
    } else if (eq(b, r)) {
      if (l !== undefined) result[k] = l;
    } else return null; // Arrays are atomic: keep both complete versions on overlap.
  }
  return { ...remote, payload: result };
}
