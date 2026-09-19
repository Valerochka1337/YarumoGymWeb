import { afterEach, describe, expect, it, vi } from "vitest";
import { WebAuth } from "./webAuth";
afterEach(() => vi.restoreAllMocks());
describe("web auth", () => {
  it("keeps the access token in memory and obtains CSRF before login", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "x" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "token" }), { status: 200 }),
      );
    const auth = new WebAuth();
    await auth.csrf();
    await auth.login({ email: "a@b.c", password: "secret" });
    expect(auth.token).toBe("token");
    expect(localStorage.length).toBe(0);
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({
      "X-CSRF-Token": "x",
    });
  });
});
it("uses server-owned Google configuration and keeps its access token in memory", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ clientId: "public-client" }), {
        status: 200,
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ csrfToken: "csrf" }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ nonce: "nonce" }), { status: 200 }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ accessToken: "google-token" }), {
        status: 200,
      }),
    );
  const auth = new WebAuth();
  expect(await auth.googleConfig()).toEqual({ clientId: "public-client" });
  const nonce = await auth.googleNonce();
  await auth.google({ idToken: "credential", nonce, deviceName: "Trial" });
  expect(auth.token).toBe("google-token");
  expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
    "/v1/web/auth/google/config",
    "/v1/web/auth/csrf",
    "/v1/web/auth/google/nonce",
    "/v1/web/auth/google",
  ]);
  expect(localStorage.length).toBe(0);
});
