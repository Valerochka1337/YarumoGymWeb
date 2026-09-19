import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { api, ApiError } from "../api/client";
import { WebAuth } from "../auth/webAuth";
import { clearDraft, loadDraft, saveDraft } from "../storage/trialDraft";
import { TrialAuth, type AuthMode } from "./TrialAuth";
import { newTrial, trialReducer, type TrialEvent } from "./trialReducer";
import {
  ActiveScreen,
  PreviewScreen,
  Saved,
  Summary,
  Unavailable,
} from "./TrialWorkout";
import type { Actual, Preview, TrialState } from "./types";

function tokenFromPath() {
  return location.pathname.match(/^\/r\/([A-Za-z0-9_-]{43})$/)?.[1];
}

export function TrialApp() {
  const token = tokenFromPath();
  const [state, setState] = useState<TrialState | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [storageWarning, setStorageWarning] = useState<string>();
  const [now, setNow] = useState(Date.now());
  const [timerStatus, setTimerStatus] = useState("");
  const [partial, setPartial] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const auth = useRef(new WebAuth());
  const dispatch: Dispatch<TrialEvent> = (event) =>
    setState((previous) =>
      previous ? trialReducer(previous, event) : previous,
    );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoadError(undefined);
    void (async () => {
      const draft = await loadDraft(token);
      try {
        const preview = await api.preview(token);
        if (!cancelled) setLoaded(draft, preview, token, setState);
      } catch (error) {
        if (cancelled) return;
        if (draft)
          setLoaded(
            draft,
            draft.preview,
            token,
            setState,
            error instanceof ApiError && error.status === 404,
          );
        else
          setLoadError(
            error instanceof ApiError && error.status === 404
              ? "Ссылка недоступна"
              : "Не удалось загрузить программу. Проверьте сеть и повторите попытку.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, retry]);

  useEffect(() => {
    if (!state || state.phase === "saved") return;
    void saveDraft(state).then(setStorageWarning);
  }, [state]);
  useEffect(() => {
    if (state?.phase !== "active") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state?.phase]);
  useEffect(() => {
    if (
      state?.phase === "active" &&
      Math.floor((now - state.startedAt) / 1000) % 15 === 0
    ) {
      setTimerStatus(
        `Прошло ${Math.max(0, Math.floor((now - state.startedAt) / 1000))} секунд`,
      );
    }
  }, [now, state?.phase, state?.startedAt]);
  useEffect(() => {
    if (state?.restDeadlineAt && state.restDeadlineAt <= now)
      dispatch({ type: "expireRest" });
  }, [now, state?.restDeadlineAt]);
  useEffect(() => {
    const onPop = () => {
      if (state?.pendingSaveRequest) return;
      if (state?.phase === "summary") dispatch({ type: "backActive" });
      else if (state?.phase === "active") dispatch({ type: "backPreview" });
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [state?.phase, state?.pendingSaveRequest]);

  if (!token) return <Unavailable title="Некорректная ссылка" />;
  if (!state) {
    return loadError ? (
      <main className="trial-shell trial-centered">
        <section className="trial-empty">
          <h1>{loadError}</h1>
          <button
            className="trial-primary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Повторить
          </button>
        </section>
      </main>
    ) : (
      <main className="trial-shell trial-centered" aria-busy="true">
        <section className="trial-empty">
          <div className="trial-loader" />
          <p>Загружаем программу…</p>
        </section>
      </main>
    );
  }

  const completed = state.exercises
    .flat()
    .filter((set) => set.completed).length;
  const total = state.exercises.flat().length;

  const save = async () => {
    if (!state.pendingSaveRequest || !auth.current.token) return;
    dispatch({ type: "saving" });
    try {
      const receipt = await api.save(
        state.token,
        state.pendingSaveRequest,
        auth.current.token,
      );
      clearDraft(state.token);
      dispatch({ type: "saved", ...receipt });
    } catch (error) {
      dispatch({
        type: "saveError",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить результаты",
      });
    }
  };
  const runAuth = async (action: () => Promise<void>) => {
    setAuthBusy(true);
    setAuthNotice(undefined);
    dispatch({ type: "clearError" });
    try {
      await action();
    } catch (error) {
      dispatch({
        type: "authError",
        message: error instanceof Error ? error.message : "Ошибка входа",
      });
    } finally {
      setAuthBusy(false);
    }
  };
  const login = () =>
    runAuth(async () => {
      await auth.current.csrf();
      await auth.current.login({
        email,
        password,
        deviceName: "Yarumo Browser Trial",
      });
      await save();
    });
  const register = () =>
    runAuth(async () => {
      await auth.current.csrf();
      await auth.current.register({ email, password });
      setCode("");
      setAuthMode("verify");
    });
  const verify = () =>
    runAuth(async () => {
      await auth.current.verify(email, code);
      setPassword("");
      setCode("");
      setAuthMode("login");
      setAuthNotice(
        "Email подтверждён. Теперь войдите, чтобы сохранить результаты.",
      );
    });
  const finish = () => {
    if (completed === 0) dispatch({ type: "finish", now: Date.now() });
    else if (completed < total) setPartial(true);
    else {
      dispatch({ type: "finish", now: Date.now() });
      history.pushState({ phase: "summary" }, "");
    }
  };

  return (
    <main className={`trial-shell trial-phase-${state.phase}`}>
      <p className="sr-only" aria-live="polite">
        {timerStatus}
      </p>
      {storageWarning && (
        <p role="alert" className="trial-warning">
          {storageWarning}
        </p>
      )}
      {state.error && state.phase !== "active" && state.phase !== "auth" && (
        <p role="alert" className="trial-error">
          {state.error}
        </p>
      )}
      {authNotice && state.phase === "auth" && (
        <p role="status" className="trial-notice">
          {authNotice}
        </p>
      )}

      {state.phase === "preview" && (
        <PreviewScreen
          state={state}
          onStart={() => {
            dispatch({ type: "start", now: Date.now() });
            history.pushState({ phase: "active" }, "");
          }}
          onReset={() => setPartial(true)}
        />
      )}
      {state.phase === "active" && (
        <ActiveScreen
          state={state}
          now={now}
          onActual={(exerciseIndex, setIndex, actual: Actual) =>
            dispatch({ type: "actual", exerciseIndex, setIndex, actual })
          }
          onComplete={(exerciseIndex, setIndex) =>
            dispatch({
              type: "complete",
              exerciseIndex,
              setIndex,
              now: Date.now(),
            })
          }
          onAdjustRest={(seconds) =>
            dispatch({ type: "adjustRest", seconds, now: Date.now() })
          }
          onSkip={() => dispatch({ type: "skipRest" })}
          onFinish={finish}
          onClearError={() => dispatch({ type: "clearError" })}
        />
      )}
      {state.phase === "summary" && (
        <Summary
          state={state}
          completed={completed}
          onSave={() => {
            dispatch({ type: "auth" });
            setAuthMode("login");
          }}
          onBack={() => {
            dispatch({ type: "resume" });
            history.back();
          }}
        />
      )}
      {state.phase === "auth" && (
        <TrialAuth
          auth={auth.current}
          mode={authMode}
          email={email}
          password={password}
          code={code}
          busy={authBusy}
          error={state.error}
          onModeChange={(mode) => {
            setAuthMode(mode);
            dispatch({ type: "clearError" });
            setAuthNotice(undefined);
          }}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onCodeChange={setCode}
          onLogin={login}
          onRegister={register}
          onVerify={verify}
          onGoogleSuccess={save}
          onGoogleError={(message) => dispatch({ type: "authError", message })}
          onCancel={() => dispatch({ type: "cancelAuth" })}
        />
      )}
      {state.phase === "saving" && (
        <section className="trial-empty" aria-live="polite">
          <div className="trial-loader" />
          <h1>Сохраняем результаты…</h1>
          <p>Не закрывайте страницу ещё несколько секунд.</p>
        </section>
      )}
      {state.phase === "saved" && <Saved />}

      {partial && (
        <div
          className="trial-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="partial-title"
        >
          <section>
            <h2 id="partial-title" tabIndex={-1}>
              {state.phase === "preview"
                ? "Начать заново?"
                : "Завершить частично?"}
            </h2>
            <p>
              {state.phase === "preview"
                ? "Текущий локальный черновик будет удалён только для этой ссылки."
                : `В историю попадут только ${completed} выполненных подходов.`}
            </p>
            <button
              className="trial-primary"
              onClick={() => {
                setPartial(false);
                if (state.phase === "preview") {
                  clearDraft(state.token);
                  setState(newTrial(state.token, state.preview));
                } else {
                  dispatch({ type: "finish", now: Date.now() });
                  history.pushState({ phase: "summary" }, "");
                }
              }}
            >
              {state.phase === "preview"
                ? "Удалить черновик и начать"
                : "Завершить тренировку"}
            </button>
            <button
              className="trial-text-button"
              onClick={() => setPartial(false)}
            >
              Продолжить тренировку
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function setLoaded(
  draft: Awaited<ReturnType<typeof loadDraft>>,
  preview: Preview,
  token: string,
  setState: Dispatch<SetStateAction<TrialState | null>>,
  revoked = false,
) {
  const fresh = newTrial(token, preview);
  const loaded: TrialState = draft
    ? {
        ...fresh,
        ...draft,
        preview,
        phase: draft.saved
          ? "saved"
          : draft.finishedAt
            ? "summary"
            : draft.phase === "active"
              ? "active"
              : "preview",
        revoked,
      }
    : { ...fresh, revoked };
  if (loaded.phase === "active") {
    history.replaceState({ phase: "preview" }, "");
    history.pushState({ phase: "active" }, "");
  }
  if (loaded.phase === "summary") {
    history.replaceState({ phase: "preview" }, "");
    history.pushState({ phase: "active" }, "");
    history.pushState({ phase: "summary" }, "");
  }
  setState(loaded);
}
