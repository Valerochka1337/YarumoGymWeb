import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Link } from "react-router-dom";
import {
  Dumbbell,
  CalendarDays,
  ChartNoAxesCombined,
  UserRound,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import { db } from "./core/db";
import { webAuth, currentSession } from "./core/auth";
import { sync } from "./core/sync";
import { AppContext } from "./ui";
import { Journal, Workout, Catalog, Routines, Gyms } from "./pages/Journal";
import { CalendarPage } from "./pages/Calendar";
import { Analysis, Measurements } from "./pages/Analysis";
import { Account } from "./pages/Account";
import { Coach } from "./pages/Coach";
import styles from "./App.module.css";
export default function App() {
  const [owner, setOwner] = useState<string>(),
    [notice, setNotice] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [busy, setBusy] = useState(false),
    [storageError, setStorageError] = useState(false);
  const active = useLiveQuery(
    () => (owner ? db.active.get(owner) : undefined),
    [owner],
  );
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    void (async () => {
      let last = (await db.meta.get("lastOwner"))?.value ?? "guest";
      setOwner(last);
      try {
        await webAuth("refresh");
        last = currentSession()!.userId;
      } catch {}
      setOwner(last);
    })().catch(() => setStorageError(true));
  }, []);
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  async function synchronize(silent = false) {
    if (!owner || owner === "guest" || !online || active) return;
    setBusy(true);
    try {
      await sync(owner);
      if (!silent) setNotice("Синхронизация завершена");
    } catch (e) {
      if (!silent) setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!owner) return;
    void synchronize(true);
    const show = () => {
      if (document.visibilityState === "visible") void synchronize(true);
    };
    window.addEventListener("online", show);
    document.addEventListener("visibilitychange", show);
    return () => {
      window.removeEventListener("online", show);
      document.removeEventListener("visibilitychange", show);
    };
  }, [owner, active, online]);
  if (storageError)
    return (
      <main className="loading" role="alert">
        <h1>Локальное хранение недоступно</h1>
        <p>
          Разрешите хранение данных в браузере и проверьте свободное место.
          Дневник не очищен.
        </p>
        <button onClick={() => location.reload()}>Повторить</button>
      </main>
    );
  if (!owner) return <main className="loading">Открываем дневник…</main>;
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      setNotice(
        (e as Error).message ||
          "Изменение не сохранено. Проверьте доступное место.",
      );
    }
  };
  return (
    <AppContext.Provider value={{ owner, run, message: setNotice }}>
      <div className={styles.app}>
        <aside className={styles.sidebar}>
          <Link to="/" className={styles.brand}>
            <img src="/icon-192.png" width="44" height="44" alt="" />
            <strong>
              yarumo<small>coach</small>
            </strong>
          </Link>
          <nav>
            {[
              ["/", "Тренировки", Dumbbell],
              ["/calendar", "Календарь", CalendarDays],
              ["/analysis", "Анализ", ChartNoAxesCombined],
            ].map(([to, label, Icon]) => {
              const I = Icon as typeof Dumbbell;
              return (
                <NavLink key={String(to)} to={String(to)} end>
                  <I size={22} />
                  <span>{String(label)}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className={styles.sidebarBottom}>
            <p>
              Ваш ритм.
              <br />
              Ваш прогресс.
            </p>
            <Link to="/account">
              <UserRound size={20} />{" "}
              {owner === "guest" ? "Гостевой дневник" : "Мой профиль"}
            </Link>
          </div>
        </aside>
        <div className={styles.body}>
          <header className={styles.top}>
            <span>
              {new Date().toLocaleDateString("ru", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
            <div>
              {!online && (
                <span className="badge">
                  <CloudOff size={16} />
                  Без сети
                </span>
              )}
              <button
                className="icon"
                aria-label="Синхронизировать"
                disabled={busy || !!active || owner === "guest"}
                onClick={() => void synchronize()}
              >
                <RefreshCw size={20} />
              </button>
              <Link className="avatar" to="/account" aria-label="Профиль">
                <UserRound size={20} />
              </Link>
            </div>
          </header>
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Закрыть уведомление"
              >
                ×
              </button>
            </div>
          )}
          {needRefresh && (
            <div className="notice">
              Доступна новая версия.{" "}
              {active ? (
                "Обновление доступно после завершения тренировки."
              ) : (
                <button
                  onClick={() =>
                    void run(async () => {
                      if ((await db.active.count()) === 0)
                        await updateServiceWorker(true);
                      else
                        throw new Error(
                          "Завершите активные тренировки во всех аккаунтах.",
                        );
                    })
                  }
                >
                  Обновить
                </button>
              )}
            </div>
          )}
          <main className={styles.main}>
            <Routes>
              <Route path="/" element={<Journal />} />
              <Route path="/workout/:id" element={<Workout />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/routines" element={<Routines />} />
              <Route path="/gyms" element={<Gyms />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/measurements" element={<Measurements />} />
              <Route
                path="/account"
                element={<Account changeOwner={setOwner} />}
              />
              <Route path="/coach" element={<Coach />} />
              <Route
                path="*"
                element={
                  <>
                    <h1>Страница не найдена</h1>
                    <Link to="/">К тренировкам</Link>
                  </>
                }
              />
            </Routes>
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
