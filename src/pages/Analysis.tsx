import { InBody } from "./InBody";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus } from "lucide-react";
import { records, save } from "../core/db";
import { volume } from "../core/workout";
import type { Payload, LocalRecord } from "../core/types";
import { useExercises } from "./Journal";
import { useApp, Empty, Modal, Field, Form, val, num, dateFormat } from "../ui";
export function Analysis() {
  const { owner } = useApp(),
    workouts = useLiveQuery(() => records(owner, "workout"), [owner]) ?? [],
    exercises = useExercises(),
    types = new Map(exercises.map((e) => [e.id, e.payload!.type])),
    finished = workouts.filter((w) => w.payload!.finishedAt),
    total = finished.reduce((sum, w) => sum + volume(w.payload!, types), 0),
    sets = finished
      .flatMap((w) => w.payload!.exercises.flatMap((r: Payload) => r.sets))
      .filter((s: Payload) => s.isCompleted),
    recent = finished
      .sort((a, b) => a.payload!.startedAt - b.payload!.startedAt)
      .slice(-12),
    volumes = recent.map((w) => volume(w.payload!, types)),
    maximum = Math.max(1, ...volumes);
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">ПРОГРЕСС В ДЕТАЛЯХ</p>
          <h1>Каждый подход в счёт</h1>
        </div>
        <Link className="subtle" to="/measurements">
          Замеры <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="grid stats">
        <article className="card">
          <p>Тренировок</p>
          <strong>{finished.length}</strong>
          <small>за всё время</small>
        </article>
        <article className="card">
          <p>Общий объём</p>
          <strong>
            {total.toLocaleString("ru")} <small>кг</small>
          </strong>
          <small>выполненные силовые подходы</small>
        </article>
        <article className="card">
          <p>Подходов</p>
          <strong>{sets.length}</strong>
          <small>завершено</small>
        </article>
      </div>
      <section className="card">
        <h2>Объём тренировок</h2>
        {recent.length ? (
          <div
            className="chart"
            role="img"
            aria-label={recent
              .map(
                (w, i) =>
                  `${dateFormat(w.payload!.startedAt)}: ${volumes[i]} кг`,
              )
              .join("; ")}
          >
            {recent.map((w, i) => (
              <div className="chartColumn" key={w.id}>
                <span>{volumes[i]}</span>
                <div
                  style={{
                    height: `${Math.max(2, (volumes[i] / maximum) * 150)}px`,
                  }}
                />
                <small>
                  {new Date(w.payload!.startedAt).toLocaleDateString("ru", {
                    day: "numeric",
                    month: "numeric",
                  })}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Начало вашей истории">
            График появится после первой завершённой тренировки.
          </Empty>
        )}
      </section>
      <section>
        <h2>Рекорды по весу</h2>
        {exercises.map((e) => {
          const weights = finished
            .flatMap((w) =>
              w
                .payload!.exercises.filter(
                  (r: Payload) => r.exerciseId === e.id,
                )
                .flatMap((r: Payload) => r.sets),
            )
            .filter((s: Payload) => s.isCompleted && s.weightKg != null)
            .map((s: Payload) => s.weightKg);
          return weights.length ? (
            <div className="listRow" key={e.id}>
              <strong>{e.payload!.name}</strong>
              <strong className="push accent">{Math.max(...weights)} кг</strong>
            </div>
          ) : null;
        })}
      </section>
    </>
  );
}
const fields: Record<string, string> = {
  weightKg: "Вес, кг",
  skeletalMuscleMassKg: "Скелетная мышечная масса, кг",
  bodyFatPercentage: "Жир, %",
  bodyFatMassKg: "Жировая масса, кг",
  waistCm: "Талия, см",
  chestCm: "Грудь, см",
  hipsCm: "Бёдра, см",
  rightRelaxedArmCm: "Правая рука, см",
  rightThighCm: "Правое бедро, см",
};
export function Measurements() {
  const { owner, run } = useApp(),
    list = useLiveQuery(() => records(owner, "measurement"), [owner]) ?? [],
    [editing, setEditing] = useState<LocalRecord | true | null>(null);
  return (
    <>
      <div className="heading">
        <h1>Замеры</h1>
        <button className="primary" onClick={() => setEditing(true)}>
          <Plus size={18} />
          Добавить
        </button>
      </div>
      {list
        .sort((a, b) => b.payload!.measuredAt - a.payload!.measuredAt)
        .map((r) => (
          <article className="card" key={r.id}>
            <div className="sectionHeading">
              <h2>{dateFormat(r.payload!.measuredAt)}</h2>
              <button onClick={() => setEditing(r)}>Изменить</button>
            </div>
            <div className="measurementGrid">
              {Object.entries(fields)
                .filter(([k]) => r.payload![k] != null)
                .map(([k, l]) => (
                  <p key={k}>
                    {l}
                    <strong>{r.payload![k]}</strong>
                  </p>
                ))}
            </div>
          </article>
        ))}
      {!list.length && (
        <Empty title="Прогресс бывает разным">
          Добавьте замеры, чтобы наблюдать за изменениями.
        </Empty>
      )}
      <InBody />
      {editing && (
        <Modal title="Замеры тела" close={() => setEditing(null)}>
          <Form
            onSave={async (data) => {
              const old = editing === true ? null : editing;
              await save(owner, "measurement", old?.id ?? crypto.randomUUID(), {
                ...old?.payload,
                measuredAt: new Date(val(data, "date")).getTime(),
                ...Object.fromEntries(
                  Object.keys(fields).map((k) => [k, num(data, k)]),
                ),
              });
              setEditing(null);
            }}
          >
            <Field label="Дата и время">
              <input
                name="date"
                type="datetime-local"
                required
                defaultValue={new Date(
                  (editing === true
                    ? Date.now()
                    : editing.payload!.measuredAt) -
                    new Date().getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)}
              />
            </Field>
            {Object.entries(fields).map(([k, l]) => (
              <Field key={k} label={l}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={k === "bodyFatPercentage" ? 100 : undefined}
                  step="0.1"
                  name={k}
                  defaultValue={
                    editing === true ? "" : (editing.payload![k] ?? "")
                  }
                />
              </Field>
            ))}
          </Form>
          {editing !== true && (
            <button
              className="danger"
              onClick={() => {
                if (confirm("Удалить замер?"))
                  void run(async () => {
                    await save(owner, "measurement", editing.id, null, true);
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
