import { channel, db, lock } from "./db";
export interface Session {
  userId: string;
  email: string;
  accessToken: string;
  expiresIn: number;
}
let session: Session | null = null;
let csrf: string | null = null;
let expiresAt = 0;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function decode(response: Response) {
  if (!response.ok) {
    let message = "Сервер недоступен";
    try {
      message = (await response.json()).message ?? message;
    } catch {}
    throw new ApiError(response.status, message);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
export function currentSession() {
  return session;
}
export async function webAuth(action: string, body?: unknown): Promise<any> {
  return lock("auth", async () => {
    if (!csrf)
      csrf = (
        await decode(
          await fetch("/v1/web/auth/csrf", {
            credentials: "same-origin",
            cache: "no-store",
            signal: AbortSignal.timeout(20000),
          }),
        )
      ).csrfToken;
    const response = await fetch(`/v1/web/auth/${action}`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf! },
      body: JSON.stringify(body ?? {}),
    });
    const data = await decode(response);
    if (data?.accessToken) {
      session = data;
      expiresAt = Date.now() + data.expiresIn * 1000;
      await db.meta.put({ key: "lastOwner", value: data.userId });
      channel?.postMessage({ type: "auth-changed" });
    }
    if (action === "logout") {
      session = null;
      channel?.postMessage({ type: "signed-out" });
    }
    return data;
  });
}
channel?.addEventListener("message", (event) => {
  if (event.data.type === "signed-out") {
    session = null;
    expiresAt = 0;
  }
  if (event.data.type === "auth-changed") expiresAt = 0;
});
export async function api(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const expectedOwner =
    session?.userId ?? (await db.meta.get("lastOwner"))?.value;
  await authorizedSession(expectedOwner);
  const response = await fetch(`/v1${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      Authorization: `Bearer ${session!.accessToken}`,
    },
  });
  if (response.status === 401) {
    session = null;
    throw new ApiError(
      401,
      "Сессия истекла. Войдите повторно; локальные изменения сохранены.",
    );
  }
  return response;
}
export async function apiJson(path: string, init: RequestInit = {}) {
  return decode(await api(path, init));
}

export async function authorizedSession(owner: string) {
  if (!session || Date.now() >= expiresAt - 30000) await webAuth("refresh");
  if (!session || session.userId !== owner)
    throw new Error(
      "Аккаунт изменился в другой вкладке. Откройте профиль и войдите в аккаунт владельца дневника.",
    );
  return session;
}
