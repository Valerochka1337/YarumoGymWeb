import { Profile } from "./Profile";
import { GoogleSignIn } from "./GoogleSignIn";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, lock } from "../core/db";
import { currentSession, webAuth, apiJson } from "../core/auth";
import { resolveConflict } from "../core/sync";
import { useApp, Field, Form, val, Empty } from "../ui";
export function Account({
  changeOwner,
}: {
  changeOwner: (owner: string) => void;
}) {
  const { owner, run, message } = useApp(),
    [mode, setMode] = useState("login"),
    [sessions, setSessions] = useState<any[]>([]),
    [theme, setTheme] = useState(localStorage.getItem("theme") ?? "system");
  const rows =
      useLiveQuery(
        () => db.records.where("owner").equals(owner).toArray(),
        [owner],
      ) ?? [],
    conflicts = rows.filter((r) => r.conflict),
    dirty = rows.filter((r) => r.dirty).length;
  async function change(next: string) {
    if (await db.active.get(owner))
      throw new Error("Завершите тренировку перед сменой аккаунта");
    await db.meta.put({ key: "lastOwner", value: next });
    changeOwner(next);
  }
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">ВАШ ДНЕВНИК</p>
          <h1>Профиль</h1>
        </div>
      </div>
      <section className="card">
        <h2>
          {currentSession()?.email ??
            (owner === "guest" ? "Гостевой дневник" : "Войдите повторно")}
        </h2>
        <p>{dirty} изменений ожидают синхронизации</p>
        <p className="muted">
          Гостевые записи сохраняются отдельно от аккаунта.
        </p>
        {!currentSession() || owner === "guest" ? (
          <>
            <GoogleSignIn signedIn={change} />
            <div className="toolbar">
              {[
                ["login", "Вход"],
                ["register", "Регистрация"],
                ["password/request", "Сброс пароля"],
                ["verify", "Подтвердить email"],
                ["password/reset", "Новый пароль"],
              ].map(([m, l]) => (
                <button
                  key={m}
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                >
                  {l}
                </button>
              ))}
            </div>
            <Form
              onSave={async (data) => {
                if (await db.active.get(owner))
                  throw new Error("Завершите тренировку перед входом");
                const result = await webAuth(mode, {
                  email: val(data, "email"),
                  password: String(data.get("password") ?? ""),
                  code: val(data, "code"),
                  deviceName: "Yarumo Web",
                });
                if (result.accessToken) await change(result.userId);
                else
                  message(
                    "Готово. Проверьте почту или войдите с новым паролем.",
                  );
              }}
            >
              <Field label="Email">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </Field>
              {["login", "register", "password/reset"].includes(mode) && (
                <Field label="Пароль">
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                </Field>
              )}
              {["verify", "password/reset"].includes(mode) && (
                <Field label="Код из письма">
                  <input
                    name="code"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </Field>
              )}
            </Form>
          </>
        ) : (
          <div className="toolbar">
            <button
              onClick={() =>
                void run(async () => setSessions(await apiJson("/sessions")))
              }
            >
              Устройства и сессии
            </button>
            <button
              onClick={() =>
                void run(async () => {
                  if (await db.active.get(owner))
                    throw new Error("Сначала завершите тренировку");
                  await webAuth("logout");
                  await change("guest");
                })
              }
            >
              Выйти
            </button>
          </div>
        )}
        {sessions.map((s) => (
          <div className="listRow" key={s.id}>
            <div>
              <strong>{s.deviceName}</strong>
              <p>
                {s.current
                  ? "Это устройство"
                  : new Date(s.createdAt).toLocaleDateString("ru")}
              </p>
            </div>
            <button
              className="push"
              onClick={() =>
                void run(async () => {
                  await apiJson(`/sessions/${s.id}`, { method: "DELETE" });
                  setSessions(sessions.filter((x) => x.id !== s.id));
                })
              }
            >
              Отозвать
            </button>
          </div>
        ))}
      </section>
      <Profile />
      <section className="card">
        <h2>Настройки приложения</h2>
        <Field label="Оформление">
          <select
            value={theme}
            onChange={(e) => {
              const value = e.target.value;
              setTheme(value);
              localStorage.setItem("theme", value);
              document.documentElement.dataset.theme = value;
            }}
          >
            <option value="system">Как в системе</option>
            <option value="light">Светлое</option>
            <option value="dark">Тёмное</option>
          </select>
        </Field>
        <button
          onClick={() =>
            void run(async () =>
              message(
                (await navigator.storage?.persist())
                  ? "Браузер разрешил постоянное хранение."
                  : "Браузер не предоставил постоянное хранение. Регулярно синхронизируйте дневник.",
              ),
            )
          }
        >
          Защитить локальное хранение
        </button>
        <p>
          На iPhone: откройте меню «Поделиться» в Safari и выберите «На экран
          Домой».
        </p>
      </section>
      {conflicts.length > 0 && (
        <section>
          <h2>Конфликты · {conflicts.length}</h2>
          {conflicts.map((r) => (
            <article className="card" key={r.key}>
              <h3>{r.payload?.name ?? r.kind}</h3>
              <p>Обе версии сохранены. Выберите, какую оставить.</p>
              <div className="grid">
                <div>
                  <h3>На устройстве</h3>
                  <pre>{JSON.stringify(r.payload, null, 2)}</pre>
                  <button
                    onClick={() => void run(() => resolveConflict(r, "local"))}
                  >
                    Оставить локальную
                  </button>
                </div>
                <div>
                  <h3>На сервере</h3>
                  <pre>
                    {r.conflict!.deleted
                      ? "Удалено"
                      : JSON.stringify(r.conflict!.payload, null, 2)}
                  </pre>
                  <button
                    onClick={() => void run(() => resolveConflict(r, "remote"))}
                  >
                    Принять серверную
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
      <section className="card">
        <h2>Данные на устройстве</h2>
        <button
          onClick={() =>
            void run(async () => {
              const data = await db.records
                  .where("owner")
                  .equals(owner)
                  .toArray(),
                url = URL.createObjectURL(
                  new Blob(
                    [
                      JSON.stringify(
                        {
                          owner,
                          exportedAt: new Date().toISOString(),
                          records: data,
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  ),
                );
              const a = document.createElement("a");
              a.href = url;
              a.download = "yarumo-journal-backup.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
          }
        >
          Скачать резервную копию
        </button>
        <button
          className="danger"
          onClick={() => {
            if (
              confirm(
                dirty
                  ? "На устройстве есть несинхронизированные изменения. Удалить их безвозвратно?"
                  : "Очистить локальный дневник этого аккаунта?",
              )
            )
              void run(() =>
                lock("journal", () =>
                  db.transaction(
                    "rw",
                    db.records,
                    db.outbox,
                    db.active,
                    async () => {
                      if (await db.active.get(owner))
                        throw new Error("Завершите тренировку перед очисткой");
                      await db.records.where("owner").equals(owner).delete();
                      await db.outbox.delete(owner);
                    },
                  ),
                ),
              );
          }}
        >
          Очистить локальные данные
        </button>
      </section>
    </>
  );
}
