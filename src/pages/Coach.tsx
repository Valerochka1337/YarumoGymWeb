import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { apiJson, currentSession } from "../core/auth";
import { db, save } from "../core/db";
import { freshContext, approveProposal, retryApproval } from "../core/actions";
import { zone, localDate, resolveTime } from "../core/calendar";
import { useExercises } from "./Journal";
import { useApp, Field, Form, val, num, Empty, Modal } from "../ui";
export function Coach() {
  const { run, owner, message } = useApp(),
    [items, setItems] = useState<any[]>([]),
    [loaded, setLoaded] = useState(false),
    [mode, setMode] = useState("coaches"),
    [invite, setInvite] = useState<string>(),
    [accepting, setAccepting] = useState(false),
    [proposals, setProposals] = useState<any[]>([]),
    [preview, setPreview] = useState<any>(),
    [exerciseDraft, setExerciseDraft] = useState<any>(),
    exercises = useExercises();
  const pending = useLiveQuery(() => db.meta.get(`proposal:${owner}`), [owner]);
  async function load() {
    let cursor: string | null = null;
    const list = [];
    do {
      const page = await apiJson(
        `/coach-relations/${mode}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      list.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    setItems(list);
    setLoaded(true);
  }
  async function loadProposals() {
    let cursor: string | null = null;
    const list = [];
    do {
      const page = await apiJson(
        `/training-proposals${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      list.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    setProposals(list);
  }
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">ПОДДЕРЖКА</p>
          <h1>Тренер и AI</h1>
        </div>
      </div>
      {owner === "guest" || !currentSession() ? (
        <Empty title="Нужен вход в аккаунт">
          Тренерские сценарии и AI работают через сервер. Войдите в профиле.
        </Empty>
      ) : (
        <>
          <section className="card">
            <h2>Тренер и клиенты</h2>
            <div className="toolbar">
              <select
                aria-label="Тренеры или клиенты"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  setLoaded(false);
                  setItems([]);
                }}
              >
                <option value="coaches">Мои тренеры</option>
                <option value="clients">Мои клиенты</option>
              </select>
              <button onClick={() => void run(load)}>Загрузить</button>
              <button onClick={() => setAccepting(true)}>
                Принять приглашение
              </button>
              <button
                onClick={() =>
                  void run(async () => {
                    const result = await apiJson(
                      "/coach-relations/invitations",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          operationId: crypto.randomUUID(),
                        }),
                      },
                    );
                    setInvite(result.token);
                  })
                }
              >
                Пригласить клиента
              </button>
            </div>
            {invite && (
              <Field label="Код приглашения · передайте клиенту">
                <input readOnly value={invite} />
              </Field>
            )}
            {items.map((r) => (
              <article className="listRow" key={r.relationId}>
                <div>
                  <strong>{r.counterpartyId}</strong>
                  <p>
                    {r.state === "ACTIVE" ? "Связь активна" : "Связь отозвана"}
                  </p>
                  <p>
                    {r.calendar ? "Календарь доступен. " : ""}
                    {r.completedWorkouts ? "История доступна." : ""}
                  </p>
                </div>
                {r.state === "ACTIVE" && (
                  <button
                    onClick={() => {
                      if (confirm("Отозвать связь и доступ к данным?"))
                        void run(async () => {
                          await apiJson(
                            `/coach-relations/${r.relationId}/revoke`,
                            {
                              method: "POST",
                              body: JSON.stringify({
                                operationId: crypto.randomUUID(),
                              }),
                            },
                          );
                          await load();
                        });
                    }}
                  >
                    Отозвать связь
                  </button>
                )}
              </article>
            ))}
            {loaded && !items.length && <p>Связей пока нет.</p>}
          </section>
          <section className="card">
            <div className="sectionHeading">
              <h2>Предложения тренировок</h2>
              <button onClick={() => void run(loadProposals)}>Загрузить</button>
            </div>
            {pending && (
              <div className="notice">
                Подтверждение ожидает ответа сервера.
                <button
                  onClick={() =>
                    void run(async () => {
                      await retryApproval(owner);
                      await loadProposals();
                    })
                  }
                >
                  Повторить подтверждение
                </button>
              </div>
            )}
            {proposals.map((p) => (
              <article className="listRow" key={p.proposalId}>
                <div>
                  <strong>{p.snapshot.draft.name}</strong>
                  <p>
                    {p.status} · {p.snapshot.draft.exercises.length} упражнений
                  </p>
                </div>
                <button className="push" onClick={() => setPreview(p)}>
                  Посмотреть
                </button>
              </article>
            ))}
          </section>
          <section className="card">
            <h2>Подготовить тренировку с AI</h2>
            <p>
              Результат появится как предложение. Запись в календарь — после
              вашего подтверждения.
            </p>
            <Form
              onSave={async (data) => {
                const context = await freshContext(owner);
                const response = await apiJson("/ai/calendar-drafts", {
                  method: "POST",
                  body: JSON.stringify({
                    requestId: crypto.randomUUID(),
                    ...context,
                    startsAtMillis: resolveTime(
                      val(data, "date"),
                      val(data, "time"),
                      zone(),
                    ),
                    timeZoneId: zone(),
                    gymIds: [],
                    excludedExerciseIds: [],
                    excludedEquipmentIds: [],
                    priorityMuscles: [],
                    includeNotes: false,
                    availableDurationMinutes: num(data, "duration"),
                    currentState: val(data, "state") || null,
                    preferences: val(data, "preferences") || null,
                  }),
                });
                setPreview(response.proposal);
                await loadProposals();
              }}
            >
              <Field label="Дата">
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={localDate()}
                />
              </Field>
              <Field label="Время">
                <input name="time" type="time" required defaultValue="18:00" />
              </Field>
              <Field label="Длительность, минут">
                <input
                  name="duration"
                  type="number"
                  required
                  min="10"
                  max="240"
                  defaultValue="60"
                />
              </Field>
              <Field label="Самочувствие">
                <input name="state" maxLength={1000} />
              </Field>
              <Field label="Пожелания">
                <textarea name="preferences" maxLength={2000} />
              </Field>
            </Form>
          </section>
          <section className="card">
            <h2>Найти или создать упражнение с AI</h2>
            <Form
              onSave={async (data) => {
                const context = await freshContext(owner);
                const response = await apiJson("/ai/exercise-drafts", {
                  method: "POST",
                  body: JSON.stringify({
                    requestId: crypto.randomUUID(),
                    ...context,
                    description: val(data, "description"),
                  }),
                });
                setExerciseDraft(response);
              }}
            >
              <Field label="Опишите упражнение">
                <textarea name="description" maxLength={2000} required />
              </Field>
            </Form>
          </section>
        </>
      )}
      {accepting && (
        <Modal
          title="Принять приглашение тренера"
          close={() => setAccepting(false)}
        >
          <Form
            onSave={async (data) => {
              await apiJson("/coach-relations/invitations/accept", {
                method: "POST",
                body: JSON.stringify({
                  operationId: crypto.randomUUID(),
                  token: val(data, "token"),
                  calendar: data.has("calendar"),
                  completedWorkouts: data.has("history"),
                }),
              });
              setAccepting(false);
              await load();
            }}
          >
            <Field label="Код приглашения">
              <input name="token" required autoComplete="off" />
            </Field>
            <p>Выберите, чем поделиться с тренером:</p>
            <label className="checkbox">
              <input type="checkbox" name="calendar" />
              Календарь тренировок
            </label>
            <label className="checkbox">
              <input type="checkbox" name="history" />
              Завершённые тренировки
            </label>
          </Form>
        </Modal>
      )}
      {preview && (
        <Modal
          title={preview.snapshot.draft.name}
          close={() => setPreview(undefined)}
        >
          <p>
            {new Date(preview.snapshot.draft.startsAtMillis).toLocaleString(
              "ru",
            )}{" "}
            · {preview.snapshot.draft.timeZoneId}
          </p>
          {preview.snapshot.draft.exercises.map((e: any, i: number) => (
            <article key={i}>
              <h3>
                {exercises.find((x) => x.id === e.exerciseId)?.payload!.name ??
                  "Упражнение"}
              </h3>
              <p>
                {e.plannedSets
                  .map(
                    (s: any) =>
                      `${s.weightKg ?? "—"} кг × ${s.reps ?? "—"}${s.durationSec ? ` · ${s.durationSec} сек` : ""}`,
                  )
                  .join(", ")}
              </p>
            </article>
          ))}
          {preview.status === "PENDING" && (
            <div className="toolbar">
              <button
                className="primary"
                onClick={() =>
                  void run(async () => {
                    await approveProposal(owner, preview);
                    setPreview(undefined);
                    await loadProposals();
                    message("Программа и занятие добавлены в дневник");
                  })
                }
              >
                Принять и добавить в календарь
              </button>
              <button
                onClick={() =>
                  void run(async () => {
                    await apiJson(
                      `/training-proposals/${preview.proposalId}/reject`,
                      {
                        method: "POST",
                        body: JSON.stringify({
                          version: preview.currentVersion,
                          reason: null,
                        }),
                      },
                    );
                    setPreview(undefined);
                    await loadProposals();
                  })
                }
              >
                Отклонить
              </button>
            </div>
          )}
        </Modal>
      )}
      {exerciseDraft && (
        <Modal title="Предложение AI" close={() => setExerciseDraft(undefined)}>
          {exerciseDraft.result.kind === "EXISTING" ? (
            <p>
              В каталоге уже есть:{" "}
              {exercises.find((e) => e.id === exerciseDraft.result.exerciseId)
                ?.payload!.name ?? exerciseDraft.result.exerciseId}
            </p>
          ) : (
            <>
              <h3>{exerciseDraft.result.name}</h3>
              <p>
                {exerciseDraft.result.muscles
                  .map((m: any) => `${m.muscle}: ${m.contribution}%`)
                  .join(", ")}
              </p>
              <Form
                onSave={async (data) => {
                  const context = await freshContext(owner);
                  if (
                    context.expectedRevision !==
                      exerciseDraft.context.revision ||
                    context.expectedCatalogRevision !==
                      exerciseDraft.context.catalogRevision
                  )
                    throw new Error(
                      "Дневник изменился. Запросите новое предложение.",
                    );
                  await save(owner, "exercise", crypto.randomUUID(), {
                    name: exerciseDraft.result.name,
                    type: exerciseDraft.result.type,
                    muscleGroup: val(data, "group"),
                    isCustom: true,
                    updatedAt: Date.now(),
                    needsMuscleMapReview: false,
                    equipmentRequirementState: "UNKNOWN",
                    equipmentIds: [],
                    muscles: exerciseDraft.result.muscles,
                  });
                  setExerciseDraft(undefined);
                  message("Упражнение добавлено");
                }}
              >
                <Field label="Группа мышц">
                  <select name="group">
                    {Object.entries({
                      CHEST: "Грудь",
                      BACK: "Спина",
                      LEGS: "Ноги",
                      SHOULDERS: "Плечи",
                      ARMS: "Руки",
                      CORE: "Кор",
                      CARDIO: "Кардио",
                      FULL_BODY: "Всё тело",
                    }).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </Form>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
