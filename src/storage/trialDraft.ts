import type { Preview, TrialDraftV1, TrialState } from "../app/types";
import { validActual } from "../app/trialReducer";
const prefix = "yarumo.trial.v1:";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const generations = new Map<string, number>();
let writes = Promise.resolve();
export async function fingerprint(preview: Preview) {
  const bytes = new TextEncoder().encode(JSON.stringify(preview));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}
export async function saveDraft(state: TrialState): Promise<string | undefined> {
  try {
    const generation = (generations.get(state.token) ?? 0) + 1;
    generations.set(state.token, generation);
    const draft: TrialDraftV1 = { version: 1, token: state.token, preview: state.preview, previewFingerprint: await fingerprint(state.preview), operationId: state.operationId, startedAt: state.startedAt, finishedAt: state.finishedAt, phase: state.phase, restDeadlineAt: state.restDeadlineAt, exercises: state.exercises, pendingSaveRequest: state.pendingSaveRequest, saved: state.saved };
    writes = writes.catch(() => undefined).then(() => { if (generations.get(state.token) === generation) localStorage.setItem(prefix + state.token, JSON.stringify(draft)); });
    await writes;
  } catch { return "Не удалось сохранить черновик на этом устройстве"; }
}
export async function loadDraft(token: string): Promise<TrialDraftV1 | undefined> {
  try {
    const value = localStorage.getItem(prefix + token); if (!value) return undefined;
    const draft = JSON.parse(value) as TrialDraftV1;
    if (!validDraft(draft, token) || draft.previewFingerprint !== await fingerprint(draft.preview)) throw new Error();
    return draft;
  } catch { localStorage.removeItem(prefix + token); return undefined; }
}
export function clearDraft(token: string) { generations.set(token, (generations.get(token) ?? 0) + 1); localStorage.removeItem(prefix + token); }
function number(value: unknown, integer = false, min = 0): boolean { return typeof value === "number" && Number.isFinite(value) && value >= min && value <= 1_000_000 && (!integer || Number.isInteger(value)); }
function nullable(value: unknown, integer = false, min = 0): boolean { return value === null || number(value, integer, min); }
function millis(value: unknown): boolean { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 4_102_444_800_000; }
function validPreview(value: Preview): boolean { return !!value && Object.keys(value).length === 3 && typeof value.title === "string" && value.title.length <= 200 && number(value.estimatedDurationSeconds, true) && Array.isArray(value.exercises) && value.exercises.length <= 200 && value.exercises.every(e => Object.keys(e).length === 5 && typeof e.exerciseKey === "string" && typeof e.name === "string" && ["STRENGTH", "TIMED", "CARDIO"].includes(e.type) && number(e.restSeconds, true) && Array.isArray(e.sets) && e.sets.length <= 1000 && e.sets.every(s => Object.keys(s).length === 5 && nullable(s.weightKg) && nullable(s.reps,true) && nullable(s.durationSec,true) && nullable(s.speedKmh) && nullable(s.inclinePct,false,-100))); }
function validDraft(draft: TrialDraftV1, token: string): boolean {
  const started=draft.startedAt;
  const inactive=draft.phase==="preview";
  const finishedPhase=["summary","auth","saving","saved"].includes(draft.phase);
  if (draft.version !== 1 || draft.token !== token || !tokenPattern.test(token) || !validPreview(draft.preview) || !["preview","active","summary","auth","saving","saved"].includes(draft.phase) || !millis(started) || (!inactive && (!uuidPattern.test(draft.operationId) || started===0)) || (inactive && (draft.operationId!=="" || started!==0)) || (finishedPhase !== (draft.finishedAt !== undefined)) || (draft.finishedAt !== undefined && (!millis(draft.finishedAt) || draft.finishedAt < started)) || (draft.restDeadlineAt !== undefined && (draft.phase!=="active" || !millis(draft.restDeadlineAt))) || !Array.isArray(draft.exercises) || draft.exercises.length !== draft.preview.exercises.length) return false;
  if (!draft.exercises.every((sets,e)=>Array.isArray(sets)&&sets.length===draft.preview.exercises[e].sets.length&&sets.every(set=>validSetState(set,draft.preview.exercises[e].type)))) return false;
  if (["auth","saving"].includes(draft.phase) && draft.pendingSaveRequest === undefined) return false;
  if (draft.pendingSaveRequest !== undefined) {
    if (!["summary","auth","saving"].includes(draft.phase) || draft.finishedAt === undefined) return false;
    try {
      const pending=JSON.parse(draft.pendingSaveRequest);
      if (!pending || Object.keys(pending).length!==4 || pending.operationId !== draft.operationId || !millis(pending.startedAt) || pending.startedAt!==started || !millis(pending.finishedAt) || pending.finishedAt !== draft.finishedAt || !Array.isArray(pending.completedSets) || pending.completedSets.length<1 || pending.completedSets.length>200 || new Set(pending.completedSets.map((set: Record<string,unknown>)=>`${set.exerciseIndex}:${set.setIndex}`)).size!==pending.completedSets.length || !pending.completedSets.every((set: unknown)=>validPendingSet(set,pending.startedAt,pending.finishedAt,draft.preview)) || !pendingMatchesState(pending.completedSets,draft)) return false;
    } catch { return false; }
  }
  return true;
}
function validSetState(value: unknown, type: Preview["exercises"][number]["type"]): boolean { if (!value || typeof value!=="object") return false; const set=value as Record<string,unknown>; const keys=Object.keys(set); if (!keys.every(key=>["completed","completedAt","actual"].includes(key)) || !keys.includes("completed") || !keys.includes("actual") || typeof set.completed!=="boolean" || !set.actual || typeof set.actual!=="object") return false; const actual=set.actual as Record<string,unknown>; const fields=["weightKg","reps","durationSec","speedKmh","inclinePct"]; if (Object.keys(actual).length!==fields.length || !fields.every(key=>key in actual) || !nullable(actual.weightKg)||!nullable(actual.reps,true)||!nullable(actual.durationSec,true)||!nullable(actual.speedKmh)||!nullable(actual.inclinePct,false,-100)) return false; return set.completed ? millis(set.completedAt)&&validActual(type,actual as never) : set.completedAt===undefined; }
function validPendingSet(value: unknown, startedAt: number, finishedAt: number, preview: Preview): boolean { if (!value || typeof value !== "object") return false; const set=value as Record<string,unknown>; const fields=["exerciseIndex","setIndex","completedAt","weightKg","reps","durationSec","speedKmh","inclinePct"]; const completedAt=set.completedAt; const e=set.exerciseIndex as number; const s=set.setIndex as number; const actual={weightKg:set.weightKg,reps:set.reps,durationSec:set.durationSec,speedKmh:set.speedKmh,inclinePct:set.inclinePct}; return Object.keys(set).length===fields.length&&fields.every(key=>key in set)&&number(e,true)&&number(s,true)&&preview.exercises[e]?.sets[s]!==undefined&&millis(completedAt)&&(completedAt as number)>=startedAt&&(completedAt as number)<=finishedAt&&validActual(preview.exercises[e].type,actual as never); }
function pendingMatchesState(completedSets: Array<Record<string,unknown>>, draft: TrialDraftV1): boolean {
  const expected=draft.exercises.flatMap((sets,exerciseIndex)=>sets.flatMap((set,setIndex)=>set.completed?[{exerciseIndex,setIndex,completedAt:set.completedAt,...set.actual}]:[]));
  if (expected.length!==completedSets.length) return false;
  return expected.every((set,index)=>Object.entries(set).every(([key,value])=>completedSets[index]?.[key]===value));
}
