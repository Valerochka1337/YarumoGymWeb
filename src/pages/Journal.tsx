import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Plus,
  Play,
  Dumbbell,
  ChevronUp,
  ChevronDown,
  Trash2,
  Check,
  Timer,
} from "lucide-react";
import { db, save, records, guardedDelete } from "../core/db";
import { keyOf, type Payload, type LocalRecord } from "../core/types";
import { startWorkout, changeWorkout, emptySet } from "../core/workout";
import { useApp, Empty, Modal, Field, Form, val, dateFormat } from "../ui";
export function useExercises() {
  const { owner } = useApp();
  return (
    useLiveQuery(async () => {
      const personal = await records(owner, "exercise"),
        catalog = await db.catalog.where("kind").equals("exercise").toArray();
      return [
        ...personal,
        ...catalog.filter(
          (c) => !c.archived && !personal.some((p) => p.id === c.id),
        ),
      ];
    }, [owner]) ?? []
  );
}
export function Journal() {
  const { owner, run } = useApp(),
    nav = useNavigate(),
    active = useLiveQuery(() => db.active.get(owner), [owner]);
  const workouts = useLiveQuery(() => records(owner, "workout"), [owner]) ?? [],
    routines = useLiveQuery(() => records(owner, "routine"), [owner]) ?? [];
  const finished = workouts
    .filter((w) => w.payload?.finishedAt)
    .sort((a, b) => b.payload!.startedAt - a.payload!.startedAt);
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">ДНЕВНИК ТРЕНИРОВОК</p>
          <h1>Время для себя</h1>
        </div>
        <Link className="subtle" to="/catalog">
          Каталог <ArrowRight size={18} />
        </Link>
      </div>
      <section className="startCard">
        <div>
          <span className="badge">
            {active ? "ТРЕНИРОВКА ИДЁТ" : "В ВАШЕМ ТЕМПЕ"}
          </span>
          <h2>{active ? "Продолжим?" : "Сильнее с каждой тренировкой"}</h2>
          <p>
            {active
              ? "Подходы сохранены. Возвращайтесь к тренировке."
              : "Выберите программу или начните свободную тренировку."}
          </p>
          <button
            className="primary"
            onClick={() =>
              void run(async () => nav(`/workout/${await startWorkout(owner)}`))
            }
          >
            <Play size={18} />
            {active ? "Продолжить тренировку" : "Начать тренировку"}
          </button>
        </div>
        <Dumbbell className="heroIcon" aria-hidden="true" />
      </section>
      <div className="quicklinks">
        <Link to="/routines">
          Программы <ArrowRight size={18} />
        </Link>
        <Link to="/gyms">
          Мои залы <ArrowRight size={18} />
        </Link>
        <Link to="/coach">
          Мой тренер и AI <ArrowRight size={18} />
        </Link>
      </div>
      <section>
        <div className="sectionHeading">
          <h2>
            Мои программы <span>{routines.length}</span>
          </h2>
          <Link to="/routines">Все программы</Link>
        </div>
        <div className="grid">
          {routines.slice(0, 3).map((r) => (
            <article className="card" key={r.id}>
              <Dumbbell className="accent" />
              <h3>{r.payload!.name}</h3>
              <p>{r.payload!.exercises.length} упражнений</p>
              <button
                onClick={() =>
                  void run(async () =>
                    nav(`/workout/${await startWorkout(owner, r)}`),
                  )
                }
              >
                Начать <ArrowRight size={16} />
              </button>
            </article>
          ))}
        </div>
        {!routines.length && (
          <Empty title="Ваша первая программа">
            <Link to="/routines">Соберите упражнения в программу</Link> или
            начните свободную тренировку.
          </Empty>
        )}
      </section>
      <section>
        <div className="sectionHeading">
          <h2>История</h2>
          <span className="muted">{finished.length} завершено</span>
        </div>
        {finished.length ? (
          finished.map((w) => (
            <Link className="listRow" key={w.id} to={`/workout/${w.id}`}>
              <div className="tile">
                <Dumbbell />
              </div>
              <div>
                <strong>{w.payload!.name}</strong>
                <p>
                  {dateFormat(w.payload!.startedAt)} ·{" "}
                  {w.payload!.exercises.length} упражнений
                </p>
              </div>
              <ArrowRight className="push" size={20} />
            </Link>
          ))
        ) : (
          <Empty title="Здесь будет ваш прогресс">
            Завершённые тренировки появятся в истории.
          </Empty>
        )}
      </section>
    </>
  );
}
export function Workout() {
  const { id = "" } = useParams(),
    { owner, run, message } = useApp(),
    exercises = useExercises(),
    [picker, setPicker] = useState(false),
    [editable, setEditable] = useState(false),
    [now, setNow] = useState(Date.now()),
    [wake, setWake] = useState<WakeLockSentinel | null>(null);
  const record = useLiveQuery(
      () => db.records.get(keyOf(owner, "workout", id)),
      [owner, id],
    ),
    active = useLiveQuery(() => db.active.get(owner), [owner]);
  useEffect(() => {
    let release: () => void = () => {},
      cancelled = false;
    void navigator.locks?.request(
      `yarumo:editor:${owner}:${id}`,
      { ifAvailable: true },
      async (lock) => {
        if (!lock || cancelled) return;
        setEditable(true);
        await new Promise<void>((r) => (release = r));
        setEditable(false);
      },
    );
    return () => {
      cancelled = true;
      release();
    };
  }, [owner, id]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      void wake?.release();
    },
    [wake],
  );
  const remaining = Math.max(
    0,
    Math.ceil(((active?.restEndsAt ?? 0) - now) / 1000),
  );
  useEffect(() => {
    if (editable && active?.restEndsAt && remaining === 0) {
      message("Отдых завершён");
      void run(() => changeWorkout(owner, id, () => {}, null));
    }
  }, [remaining, active?.restEndsAt]);
  if (!record) return <Empty title="Открываем тренировку…" />;
  const p = record.payload!,
    done = !!p.finishedAt;
  const mutate = (fn: (p: Payload) => void, rest?: number | null) =>
    run(() => changeWorkout(owner, id, fn, rest));
  return (
    <>
      <Link className="back" to="/">
        ← Тренировки
      </Link>
      <div className="heading">
        <div>
          <p className="eyebrow">
            {done
              ? "ЗАВЕРШЕНА"
              : `${Math.floor((now - p.startedAt) / 60000)} МИН · СОХРАНЯЕТСЯ НА УСТРОЙСТВЕ`}
          </p>
          <h1>{p.name}</h1>
        </div>
        {!done && (
          <button
            disabled={!editable}
            className="primary"
            onClick={() => {
              if (confirm("Завершить тренировку?"))
                void mutate((p) => {
                  p.finishedAt = Date.now();
                });
            }}
          >
            Завершить
          </button>
        )}
      </div>
      {!editable && (
        <p className="notice">
          Тренировка открыта для редактирования в другой вкладке.
        </p>
      )}
      <Field label="Заметка к тренировке">
        <textarea
          key={`${record.id}:note`}
          defaultValue={p.note}
          maxLength={10000}
          disabled={!editable}
          onBlur={(e) => {
            if (e.target.value !== p.note)
              void mutate((p) => {
                p.note = e.target.value;
              });
          }}
        />
      </Field>
      {!done && (
        <div className="toolbar">
          <button
            onClick={() => void mutate(() => {}, 90)}
            disabled={!editable}
          >
            <Timer size={18} />
            {remaining
              ? `Отдых ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
              : "Отдых 1:30"}
          </button>
          {"wakeLock" in navigator && (
            <button
              onClick={() =>
                void run(async () => {
                  if (wake) {
                    await wake.release();
                    setWake(null);
                  } else setWake(await navigator.wakeLock.request("screen"));
                })
              }
            >
              {wake ? "Разрешить гасить экран" : "Не гасить экран"}
            </button>
          )}
        </div>
      )}
      {p.exercises.map((row: Payload, i: number) => (
        <section className="card" key={row.sectionId}>
          <div className="sectionHeading">
            <h2>
              {exercises.find((e) => e.id === row.exerciseId)?.payload?.name ??
                "Упражнение из дневника"}
            </h2>
            <div className="toolbar">
              <button
                className="icon"
                aria-label="Выше"
                disabled={!editable || i === 0}
                onClick={() =>
                  void mutate((p) => {
                    [p.exercises[i - 1], p.exercises[i]] = [
                      p.exercises[i],
                      p.exercises[i - 1],
                    ];
                    p.exercises.forEach(
                      (r: Payload, n: number) => (r.position = n),
                    );
                  })
                }
              >
                <ChevronUp />
              </button>
              <button
                className="icon"
                aria-label="Ниже"
                disabled={!editable || i === p.exercises.length - 1}
                onClick={() =>
                  void mutate((p) => {
                    [p.exercises[i + 1], p.exercises[i]] = [
                      p.exercises[i],
                      p.exercises[i + 1],
                    ];
                    p.exercises.forEach(
                      (r: Payload, n: number) => (r.position = n),
                    );
                  })
                }
              >
                <ChevronDown />
              </button>
              <button
                className="icon"
                aria-label="Удалить упражнение"
                disabled={!editable}
                onClick={() => {
                  if (confirm("Удалить упражнение и его подходы?"))
                    void mutate((p) => {
                      p.exercises.splice(i, 1);
                      p.exercises.forEach(
                        (r: Payload, n: number) => (r.position = n),
                      );
                    });
                }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
          <div className="sets">
            <div className="setRow setLabels">
              <span>Подход</span>
              <span>кг</span>
              <span>Повторы</span>
              <span>Секунды</span>
              <span>Готово</span>
            </div>
            {row.sets.map((s: Payload, j: number) => (
              <div
                className={`setRow ${s.isCompleted ? "completed" : ""}`}
                key={`${row.sectionId}:${j}`}
              >
                <span>{j + 1}</span>
                {["weightKg", "reps", "durationSec"].map((field) => (
                  <input
                    key={`${field}:${s[field]}`}
                    aria-label={`${field === "weightKg" ? "Вес" : field === "reps" ? "Повторы" : "Длительность"} ${i + 1}.${j + 1}`}
                    type="number"
                    min="0"
                    step={field === "weightKg" ? "0.5" : "1"}
                    inputMode="decimal"
                    defaultValue={s[field] ?? ""}
                    disabled={!editable}
                    onBlur={(e) => {
                      if (!e.target.validity.valid) {
                        message("Введите допустимое число");
                        return;
                      }
                      const n =
                        e.target.value === "" ? null : Number(e.target.value);
                      if (n !== s[field])
                        void mutate((p) => {
                          p.exercises[i].sets[j][field] = n;
                        });
                    }}
                  />
                ))}
                <button
                  className={s.isCompleted ? "check checked" : "check"}
                  aria-label={`Выполнен подход ${i + 1}.${j + 1}`}
                  aria-pressed={s.isCompleted}
                  disabled={!editable}
                  onClick={() =>
                    void mutate(
                      (p) => {
                        const set = p.exercises[i].sets[j];
                        set.isCompleted = !set.isCompleted;
                        set.completedAt = set.isCompleted ? Date.now() : null;
                      },
                      !done && !s.isCompleted ? 90 : undefined,
                    )
                  }
                >
                  <Check size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            disabled={!editable}
            onClick={() =>
              void mutate((p) => {
                p.exercises[i].sets.push(emptySet(p.exercises[i].sets.length));
              })
            }
          >
            <Plus size={16} /> Подход
          </button>
        </section>
      ))}
      <button
        className="wide"
        disabled={!editable}
        onClick={() => setPicker(true)}
      >
        <Plus size={18} />
        Добавить упражнение
      </button>
      {picker && (
        <Modal title="Выберите упражнение" close={() => setPicker(false)}>
          {exercises.map((e) => (
            <button
              className="listRow"
              key={e.id}
              onClick={() =>
                void run(async () => {
                  await changeWorkout(owner, id, (p) => {
                    p.exercises.push({
                      sectionId: crypto.randomUUID(),
                      exerciseId: e.id,
                      position: p.exercises.length,
                      sets: [emptySet()],
                    });
                  });
                  setPicker(false);
                })
              }
            >
              {e.payload!.name}
              <Plus className="push" size={18} />
            </button>
          ))}
          {!exercises.length && (
            <Empty title="Каталог пока пуст">
              <Link to="/catalog">Добавьте своё упражнение</Link>
            </Empty>
          )}
        </Modal>
      )}
    </>
  );
}
export function Catalog() {
  const { owner, run } = useApp(),
    exercises = useExercises(),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Payload | null>(null);
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">БИБЛИОТЕКА</p>
          <h1>Упражнения</h1>
        </div>
        <button className="primary" onClick={() => setEditing({})}>
          <Plus size={18} />
          Добавить
        </button>
      </div>
      <input
        className="search"
        aria-label="Поиск упражнений"
        placeholder="Найти упражнение"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {exercises
        .filter((e) =>
          e.payload!.name.toLowerCase().includes(query.toLowerCase()),
        )
        .map((e) => (
          <article className="listRow" key={e.id}>
            <div className="tile">
              <Dumbbell />
            </div>
            <div>
              <strong>{e.payload!.name}</strong>
              <p>
                {e.payload!.type} · {e.payload!.muscleGroup}
              </p>
            </div>
            {"owner" in e && (
              <button className="push" onClick={() => setEditing(e)}>
                Изменить
              </button>
            )}
          </article>
        ))}
      {!exercises.length && (
        <Empty title="Добавьте первое упражнение">
          Общий каталог загрузится при синхронизации аккаунта. Свои упражнения
          доступны без сети.
        </Empty>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Изменить упражнение" : "Новое упражнение"}
          close={() => setEditing(null)}
        >
          <Form
            onSave={async (data) => {
              await save(owner, "exercise", editing.id ?? crypto.randomUUID(), {
                ...editing.payload,
                name: val(data, "name"),
                muscleGroup: val(data, "group"),
                type: val(data, "type"),
                isCustom: true,
                updatedAt: Date.now(),
                needsMuscleMapReview:
                  editing.payload?.needsMuscleMapReview ?? true,
                equipmentRequirementState:
                  editing.payload?.equipmentRequirementState ?? "UNKNOWN",
                muscles: editing.payload?.muscles ?? [],
                equipmentIds: editing.payload?.equipmentIds ?? [],
              });
              setEditing(null);
            }}
          >
            <Field label="Название">
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={editing.payload?.name}
              />
            </Field>
            <Field label="Группа мышц">
              <select
                name="group"
                defaultValue={editing.payload?.muscleGroup ?? "FULL_BODY"}
              >
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
            <Field label="Тип">
              <select
                name="type"
                defaultValue={editing.payload?.type ?? "STRENGTH"}
              >
                <option value="STRENGTH">Силовое</option>
                <option value="TIMED">На время</option>
                <option value="CARDIO">Кардио</option>
              </select>
            </Field>
          </Form>
          {editing.id && (
            <button
              className="danger"
              onClick={() => {
                if (confirm("Удалить упражнение?"))
                  void run(async () => {
                    await guardedDelete(owner, "exercise", editing.id);
                    setEditing(null);
                  });
              }}
            >
              Удалить
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
export function Routines() {
  const { owner, run } = useApp(),
    nav = useNavigate(),
    list = useLiveQuery(() => records(owner, "routine"), [owner]) ?? [],
    exercises = useExercises(),
    [editing, setEditing] = useState<LocalRecord | true | null>(null),
    [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <div className="heading">
        <h1>Программы</h1>
        <button
          className="primary"
          onClick={() => {
            setSelected([]);
            setEditing(true);
          }}
        >
          <Plus size={18} />
          Создать
        </button>
      </div>
      <div className="grid">
        {list.map((r) => (
          <article className="card" key={r.id}>
            <Dumbbell className="accent" />
            <h2>{r.payload!.name}</h2>
            <p>{r.payload!.exercises.length} упражнений</p>
            <p>{r.payload!.note}</p>
            <div className="toolbar">
              <button
                onClick={() =>
                  void run(async () =>
                    nav(`/workout/${await startWorkout(owner, r)}`),
                  )
                }
              >
                Начать
              </button>
              <button
                onClick={() => {
                  setEditing(r);
                  setSelected(
                    r.payload!.exercises.map((e: Payload) => e.exerciseId),
                  );
                }}
              >
                Изменить
              </button>
            </div>
          </article>
        ))}
      </div>
      {!list.length && (
        <Empty title="Тренируйтесь по своему плану">
          Создайте программу из упражнений каталога.
        </Empty>
      )}
      {editing && (
        <Modal title="Программа" close={() => setEditing(null)}>
          <Form
            onSave={async (data) => {
              const old = editing === true ? null : editing;
              await save(owner, "routine", old?.id ?? crypto.randomUUID(), {
                ...old?.payload,
                name: val(data, "name"),
                note: val(data, "note"),
                updatedAt: Date.now(),
                gymIds: old?.payload?.gymIds ?? [],
                exercises: selected.map((id, i) => ({
                  ...old?.payload?.exercises.find(
                    (r: Payload) => r.exerciseId === id,
                  ),
                  exerciseId: id,
                  position: i,
                  restSeconds:
                    old?.payload?.exercises.find(
                      (r: Payload) => r.exerciseId === id,
                    )?.restSeconds ?? 90,
                  plannedSets: old?.payload?.exercises.find(
                    (r: Payload) => r.exerciseId === id,
                  )?.plannedSets ?? [
                    {
                      weightKg: null,
                      reps: 10,
                      durationSec: null,
                      speedKmh: null,
                      inclinePct: null,
                    },
                  ],
                })),
              });
              setEditing(null);
            }}
          >
            <Field label="Название">
              <input
                required
                name="name"
                maxLength={200}
                defaultValue={editing === true ? "" : editing.payload?.name}
              />
            </Field>
            <Field label="Заметка">
              <textarea
                name="note"
                maxLength={10000}
                defaultValue={editing === true ? "" : editing.payload?.note}
              />
            </Field>
            <p>Упражнения в порядке выбора</p>
            {exercises.map((e) => (
              <label className="checkbox" key={e.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(e.id)}
                  onChange={(ev) =>
                    setSelected(
                      ev.target.checked
                        ? [...selected, e.id]
                        : selected.filter((id) => id !== e.id),
                    )
                  }
                />
                {e.payload!.name}
              </label>
            ))}
          </Form>
          {editing !== true && (
            <button
              className="danger"
              onClick={() => {
                if (confirm("Удалить программу?"))
                  void run(async () => {
                    await guardedDelete(owner, "routine", editing.id);
                    setEditing(null);
                  });
              }}
            >
              Удалить
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
export function Gyms() {
  const { owner, run } = useApp(),
    list = useLiveQuery(() => records(owner, "gym"), [owner]) ?? [],
    equipment =
      useLiveQuery(() =>
        db.catalog.where("kind").equals("equipment").toArray(),
      ) ?? [],
    [editing, setEditing] = useState<LocalRecord | true | null>(null);
  return (
    <>
      <div className="heading">
        <h1>Мои залы</h1>
        <button className="primary" onClick={() => setEditing(true)}>
          Добавить
        </button>
      </div>
      {list.map((g) => (
        <article className="listRow" key={g.id}>
          <div>
            <h3>{g.payload!.name}</h3>
            <p>{g.payload!.equipmentIds.length} видов оборудования</p>
          </div>
          <button className="push" onClick={() => setEditing(g)}>
            Изменить
          </button>
        </article>
      ))}
      {!list.length && (
        <Empty title="Где вы тренируетесь?">
          Добавьте зал и доступное оборудование.
        </Empty>
      )}
      {editing && (
        <Modal title="Зал" close={() => setEditing(null)}>
          <Form
            onSave={async (data) => {
              const old = editing === true ? null : editing;
              await save(owner, "gym", old?.id ?? crypto.randomUUID(), {
                ...old?.payload,
                name: val(data, "name"),
                updatedAt: Date.now(),
                inventoryConfigured: true,
                exerciseIds: old?.payload?.exerciseIds ?? [],
                equipmentIds: data.getAll("equipment"),
              });
              setEditing(null);
            }}
          >
            <Field label="Название">
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={editing === true ? "" : editing.payload?.name}
              />
            </Field>
            {equipment.map((e) => (
              <label className="checkbox" key={e.id}>
                <input
                  name="equipment"
                  value={e.id}
                  type="checkbox"
                  defaultChecked={
                    editing !== true &&
                    editing.payload?.equipmentIds.includes(e.id)
                  }
                />
                {e.payload.name ?? e.id}
              </label>
            ))}
          </Form>
          {editing !== true && (
            <button
              className="danger"
              onClick={() => {
                if (confirm("Удалить зал?"))
                  void run(async () => {
                    await guardedDelete(owner, "gym", editing.id);
                    setEditing(null);
                  });
              }}
            >
              Удалить
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
