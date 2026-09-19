type Credentials = { email: string; password: string; deviceName?: string };
type Csrf = { csrfToken: string };
type GoogleConfig = { clientId?: string };
type GoogleCredential = { idToken: string; nonce: string; deviceName: string };
export class WebAuth {
  private csrfToken = "";
  private accessToken = "";
  get token() {
    return this.accessToken;
  }
  async csrf() {
    this.csrfToken = (
      await this.request<Csrf>("/v1/web/auth/csrf", { method: "GET" })
    ).csrfToken;
  }
  async register(credentials: Credentials) {
    await this.request("/v1/web/auth/register", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }
  async verify(email: string, code: string) {
    await this.request("/v1/web/auth/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  }
  async login(credentials: Credentials) {
    const result = await this.request<{ accessToken: string }>(
      "/v1/web/auth/login",
      { method: "POST", body: JSON.stringify(credentials) },
    );
    this.accessToken = result.accessToken;
  }
  async googleConfig() {
    return this.request<GoogleConfig>("/v1/web/auth/google/config", {
      method: "GET",
    });
  }
  async googleNonce() {
    if (!this.csrfToken) await this.csrf();
    return (
      await this.request<{ nonce: string }>("/v1/web/auth/google/nonce", {
        method: "POST",
      })
    ).nonce;
  }
  async google(credential: GoogleCredential) {
    const result = await this.request<{ accessToken: string }>(
      "/v1/web/auth/google",
      { method: "POST", body: JSON.stringify(credential) },
    );
    this.accessToken = result.accessToken;
  }
  async refresh() {
    const result = await this.request<{ accessToken: string }>(
      "/v1/web/auth/refresh",
      { method: "POST" },
    );
    this.accessToken = result.accessToken;
  }
  private async request<T = unknown>(
    url: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await fetch(url, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(this.csrfToken ? { "X-CSRF-Token": this.csrfToken } : {}),
      },
    });
    if (!response.ok)
      throw new Error(
        (await response.json().catch(() => null))?.message ??
          "Ошибка авторизации",
      );
    return response.json() as Promise<T>;
  }
}
