import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDraft, saveDraft } from "./trialDraft";
import { newTrial } from "../app/trialReducer";
const state = newTrial("a".repeat(43), { title:"T",estimatedDurationSeconds:0,exercises:[] }, 1);
describe("trial draft", () => { it("round trips a versioned validated draft", async () => { expect(await saveDraft(state)).toBeUndefined(); expect((await loadDraft(state.token))?.operationId).toBe(state.operationId); }); it("reports storage failure without losing in-memory state", async () => { vi.spyOn(localStorage,"setItem").mockImplementation(() => { throw new Error("quota"); }); expect(await saveDraft(state)).toMatch(/Не удалось/); }); });
afterEach(() => vi.restoreAllMocks());
it("rejects corrupt drafts instead of restoring untrusted values", async () => { localStorage.setItem("yarumo.trial.v1:" + state.token, JSON.stringify({version:1,token:state.token,operationId:"bad",preview:{},exercises:[]})); expect(await loadDraft(state.token)).toBeUndefined(); expect(localStorage.getItem("yarumo.trial.v1:" + state.token)).toBeNull(); });
