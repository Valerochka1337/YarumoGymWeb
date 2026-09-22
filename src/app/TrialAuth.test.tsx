import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { WebAuth } from "../auth/webAuth";
import { TrialAuth } from "./TrialAuth";

afterEach(() => {
  cleanup();
  delete (window as Partial<Window>).google;
  vi.restoreAllMocks();
});

it("renders the configured Google account option and continues saving after sign in", async () => {
  let callback: ((response: { credential: string }) => void) | undefined;
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn((options) => {
          callback = options.callback as typeof callback;
        }),
        renderButton: vi.fn((element) => {
          const button = document.createElement("button");
          button.textContent = "Продолжить с Google";
          button.onclick = () =>
            callback?.({ credential: "google-credential" });
          element.append(button);
        }),
      },
    },
  };
  const auth = {
    googleConfig: vi.fn().mockResolvedValue({ clientId: "public-client" }),
    googleNonce: vi.fn().mockResolvedValue("nonce"),
    google: vi.fn().mockResolvedValue(undefined),
  } as unknown as WebAuth;
  const onGoogleSuccess = vi.fn().mockResolvedValue(undefined);
  render(
    <TrialAuth
      auth={auth}
      mode="login"
      email=""
      password=""
      code=""
      busy={false}
      onModeChange={vi.fn()}
      onEmailChange={vi.fn()}
      onPasswordChange={vi.fn()}
      onCodeChange={vi.fn()}
      onLogin={vi.fn()}
      onVerify={vi.fn()}
      onGoogleSuccess={onGoogleSuccess}
      onGoogleError={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Создать аккаунт" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Регистрация на сайте недоступна. Сайт в разработке.",
  );
  expect(
    screen.getByRole("button", { name: "Войти и сохранить" }),
  ).toBeInTheDocument();
  fireEvent.click(
    await screen.findByRole("button", { name: "Продолжить с Google" }),
  );
  await waitFor(() =>
    expect(auth.google).toHaveBeenCalledWith({
      idToken: "google-credential",
      nonce: "nonce",
      deviceName: "Yarumo Browser Trial",
    }),
  );
  await waitFor(() => expect(onGoogleSuccess).toHaveBeenCalledOnce());
});
