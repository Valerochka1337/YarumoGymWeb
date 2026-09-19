import type { Preview } from "../app/types";

export class ApiError extends Error { constructor(readonly status: number, message: string) { super(message); } }
const headers = { Accept: "application/json" };
async function json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init, headers: { ...headers, ...init?.headers } });
  if (!response.ok) throw new ApiError(response.status, (await response.json().catch(() => null))?.message ?? "Не удалось выполнить запрос");
  return response.json() as Promise<T>;
}
export const api = {
  preview: (token: string) => json<Preview>(`/v1/routine-shares/preview/${encodeURIComponent(token)}`),
  save: (token: string, serializedRequest: string, accessToken: string) => json<{ routineId: string; workoutId: string }>(`/v1/routine-shares/preview/${encodeURIComponent(token)}/trial-results`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: serializedRequest }),
};
