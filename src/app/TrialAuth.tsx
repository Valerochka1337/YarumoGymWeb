import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { WebAuth } from "../auth/webAuth";

export type AuthMode = "login" | "verify";

type Props = {
  auth: WebAuth;
  mode: AuthMode;
  email: string;
  password: string;
  code: string;
  busy: boolean;
  error?: string;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onLogin: () => Promise<void>;
  onVerify: () => Promise<void>;
  onGoogleSuccess: () => Promise<void>;
  onGoogleError: (message: string) => void;
  onCancel: () => void;
};

let googleScript: Promise<void> | undefined;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScript) {
    googleScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        googleScript = undefined;
        reject(new Error("Не удалось загрузить вход Google"));
      };
      document.head.append(script);
    });
  }
  return googleScript;
}

function GoogleButton({
  auth,
  disabled,
  onSuccess,
  onError,
}: {
  auth: WebAuth;
  disabled: boolean;
  onSuccess: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const success = useRef(onSuccess);
  const failure = useRef(onError);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  useEffect(() => {
    success.current = onSuccess;
  }, [onSuccess]);
  useEffect(() => {
    failure.current = onError;
  }, [onError]);
  useEffect(() => {
    let cancelled = false;
    const mount = async () => {
      try {
        const [{ clientId }] = await Promise.all([
          auth.googleConfig(),
          loadGoogleScript(),
        ]);
        if (!clientId) throw new Error("Google-вход пока не настроен");
        const nonce = await auth.googleNonce();
        if (cancelled || !host.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce,
          auto_select: false,
          callback: ({ credential }: { credential: string }) => {
            void (async () => {
              try {
                await auth.google({
                  idToken: credential,
                  nonce,
                  deviceName: "Yarumo Browser Trial",
                });
                await success.current();
              } catch (error) {
                failure.current(
                  error instanceof Error
                    ? error.message
                    : "Ошибка входа через Google",
                );
              }
            })();
          },
        });
        host.current.replaceChildren();
        window.google.accounts.id.renderButton(host.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          locale: "ru",
          width: Math.min(400, Math.max(260, host.current.clientWidth || 360)),
        });
        setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setStatus("unavailable");
          failure.current(
            error instanceof Error ? error.message : "Google-вход недоступен",
          );
        }
      }
    };
    void mount();
    return () => {
      cancelled = true;
      host.current?.replaceChildren();
    };
  }, [auth]);

  return (
    <div
      className={`trial-google ${disabled ? "is-disabled" : ""}`}
      aria-busy={status === "loading"}
    >
      {status === "loading" && (
        <button type="button" className="trial-google-placeholder" disabled>
          Загружаем Google…
        </button>
      )}
      {status === "unavailable" && (
        <button type="button" className="trial-google-placeholder" disabled>
          Google-вход недоступен
        </button>
      )}
      <div
        ref={host}
        className="trial-google-host"
        hidden={status !== "ready"}
      />
    </div>
  );
}

export function TrialAuth({
  auth,
  mode,
  email,
  password,
  code,
  busy,
  error,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onCodeChange,
  onLogin,
  onVerify,
  onGoogleSuccess,
  onGoogleError,
  onCancel,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const emailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    email.trim().length <= 254;
  const passwordValid =
    mode === "login"
      ? password.length > 0
      : password.length >= 12 && password.length <= 128;
  const codeValid = code.length === 8;
  useEffect(() => {
    setAttempted(false);
    setShowPassword(false);
  }, [mode]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!emailValid || (mode === "verify" ? !codeValid : !passwordValid))
      return;
    void (mode === "login" ? onLogin() : onVerify());
  };
  const title = mode === "login" ? "С возвращением!" : "Проверьте почту";
  const copy =
    mode === "login"
      ? "Войдите, чтобы сохранить тренировку и продолжить в Yarumo."
      : "Введите 8 цифр из письма. Код действует 10 минут.";

  return (
    <section className="trial-auth" aria-labelledby="auth-title">
      <button
        type="button"
        className="trial-icon-button trial-auth-back"
        aria-label="Вернуться к итогам"
        onClick={onCancel}
        disabled={busy}
      >
        <ArrowLeft aria-hidden="true" />
      </button>
      <div className="trial-auth-brand" aria-hidden="true">
        <span>Y</span>
        <strong>
          Yarumo <small>coach</small>
        </strong>
      </div>
      <div className="trial-auth-card">
        <h2 id="auth-title" tabIndex={-1}>
          {title}
        </h2>
        <p>{copy}</p>
        <p role="status">
          Регистрация на сайте недоступна. Сайт в разработке. Войти можно в
          существующий аккаунт.
        </p>
        {mode === "login" && (
          <>
            <GoogleButton
              auth={auth}
              disabled={busy}
              onSuccess={onGoogleSuccess}
              onError={onGoogleError}
            />
            <div className="trial-divider">
              <span>или по email</span>
            </div>
          </>
        )}
        <form onSubmit={submit} noValidate>
          <label className="trial-field">
            <span>Email</span>
            <span className="trial-input-shell">
              <Mail aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                autoComplete="email"
                required
                aria-invalid={attempted && !emailValid}
                disabled={busy}
              />
            </span>
            {attempted && !emailValid && (
              <small className="trial-field-error">
                Введите email, например name@mail.ru
              </small>
            )}
          </label>
          {mode === "verify" ? (
            <label className="trial-field">
              <span>Код из письма</span>
              <span className="trial-input-shell">
                <Mail aria-hidden="true" />
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={code}
                  onChange={(event) =>
                    onCodeChange(
                      event.target.value.replace(/\D/g, "").slice(0, 8),
                    )
                  }
                  autoComplete="one-time-code"
                  minLength={8}
                  maxLength={8}
                  required
                  aria-invalid={attempted && !codeValid}
                  disabled={busy}
                />
              </span>
              {attempted && !codeValid && (
                <small className="trial-field-error">Введите все 8 цифр</small>
              )}
            </label>
          ) : (
            <label className="trial-field">
              <span>Пароль</span>
              <span className="trial-input-shell">
                <LockKeyhole aria-hidden="true" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => onPasswordChange(event.target.value)}
                  autoComplete="current-password"
                  maxLength={128}
                  required
                  aria-invalid={attempted && !passwordValid}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="trial-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword ? "Скрыть пароль" : "Показать пароль"
                  }
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </button>
              </span>
              {attempted && !passwordValid && mode === "login" && (
                <small className="trial-field-error">Введите пароль</small>
              )}
            </label>
          )}
          {error && (
            <p role="alert" className="trial-error">
              {error}
            </p>
          )}
          <button
            className="trial-primary trial-auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Подождите…"
              : mode === "login"
                ? "Войти и сохранить"
                : "Подтвердить email"}
          </button>
        </form>
        {mode !== "login" && (
          <button
            type="button"
            className="trial-text-button trial-auth-switch"
            onClick={() => onModeChange("login")}
            disabled={busy}
          >
            Вернуться ко входу
          </button>
        )}
      </div>
    </section>
  );
}

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (options: Record<string, unknown>) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}
