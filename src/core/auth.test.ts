import { afterEach, expect, it, vi } from "vitest";
import { googleAuthConfig } from "./auth";

afterEach(() => vi.restoreAllMocks());

it("loads the public Google client id from the same-origin backend", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ clientId: "public-client" }), {
      status: 200,
    }),
  );
  await expect(googleAuthConfig()).resolves.toEqual({
    clientId: "public-client",
  });
  expect(fetcher).toHaveBeenCalledWith(
    "/v1/web/auth/google/config",
    expect.objectContaining({ credentials: "same-origin", cache: "no-store" }),
  );
});
