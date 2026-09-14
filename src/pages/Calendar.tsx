import { exceptionId } from "../core/identity";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Temporal } from "@js-temporal/polyfill";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { db, save, records } from "../core/db";
import {
  instances,
  localDate,
  zone,
  resolveTime,
  type Instance,
} from "../core/calendar";
import { useApp, Modal, Form, Field, val, Empty } from "../ui";
export function CalendarPage() {
  const { owner, run } = useApp(),
    [month, setMonth] = useState(localDate().slice(0, 7)),
    [day, setDay] = useState(localDate()),
    [adding, setAdding] = useState(false),
    [moving, setMoving] = useState<Instance | null>(null);
  const all =
      useLiveQuery(
        () => db.records.where("owner").equals(owner).toArray(),
        [owner],
      ) ?? [],
    routines = useLiveQuery(() => records(owner, "routine"), [owner]) ?? [];
  const first = Temporal.PlainDate.from(`${month}-01`),
    last = first.add({ months: 1 }).subtract({ days: 1 }),
    events = instances(all, first.toString(), last.toString()),
    selected = events.filter(
      (e) =>
        Temporal.Instant.fromEpochMilliseconds(e.at)
          .toZonedDateTimeISO(zone())
          .toPlainDate()
          .toString() === day,
    );
  const days = Array.from({ length: first.dayOfWeek - 1 }, () => null).concat(
    Array.from({ length: first.daysInMonth }, (_, i) => i + 1) as any[],
  );
  async function exception(e: Instance, at: number | null) {
    if (e.planId) {
      if (at === null) await save(owner, "calendar_plan", e.planId, null, true);
      else {
        const old = all.find((r) => r.id === e.planId)!;
        await save(owner, "calendar_plan", e.planId, {
          ...old.payload,
          startsAtMillis: at,
        });
      }
    } else {
      const existing = all.find(
        (r) =>
          !r.deleted &&
          r.kind === "calendar_exception" &&
          r.payload?.ruleId === e.ruleId &&
          r.payload?.instanceKey === e.instanceKey,
      );
      await save(
        owner,
        "calendar_exception",
        existing?.id ?? exceptionId(e.ruleId!, e.instanceKey!),
        {
          ruleId: e.ruleId,
          instanceKey: e.instanceKey,
          kind: at === null ? "CANCELLED" : "MOVED",
          movedAtMillis: at,
        },
      );
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">ВАШ РИТМ</p>
          <h1>Календарь</h1>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>
          <Plus size={18} />
          Запланировать
        </button>
      </div>
      <section className="card">
        <div className="sectionHeading">
          <button
            className="icon"
            aria-label="Предыдущий месяц"
            onClick={() =>
              setMonth(first.subtract({ months: 1 }).toString().slice(0, 7))
            }
          >
            <ChevronLeft />
          </button>
          <h2>
            {new Date(`${month}-15T12:00:00`).toLocaleDateString("ru", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button
            className="icon"
            aria-label="Следующий месяц"
            onClick={() =>
              setMonth(first.add({ months: 1 }).toString().slice(0, 7))
            }
          >
            <ChevronRight />
          </button>
        </div>
        <div className="calendarGrid">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <span className="dayLabel" key={d}>
              {d}
            </span>
          ))}
          {days.map((d, i) => {
            const date = `${month}-${String(d).padStart(2, "0")}`;
            return d ? (
              <button
                key={date}
                className={`day ${date === day ? "selected" : ""}`}
                onClick={() => setDay(date)}
              >
                {d}
                {events.some(
                  (e) =>
                    Temporal.Instant.fromEpochMilliseconds(e.at)
                      .toZonedDateTimeISO(zone())
                      .toPlainDate()
                      .toString() === date,
                ) && <span className="eventDot" />}
              </button>
            ) : (
              <span key={`empty${i}`} />
            );
          })}
        </div>
      </section>
      <div className="sectionHeading">
        <h2>
          {new Date(`${day}T12:00:00`).toLocaleDateString("ru", {
            day: "numeric",
            month: "long",
          })}
        </h2>
        <span className="muted">{zone()}</span>
      </div>
      {selected.map((e) => (
        <article className="listRow" key={e.id}>
          <strong>
            {new Date(e.at).toLocaleTimeString("ru", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          <div>
            <h3>
              {routines.find((r) => r.id === e.routineId)?.payload!.name ??
                "Программа"}
            </h3>
            <p>
              {e.moved
                ? "Перенесено"
                : e.ruleId
                  ? "Каждую неделю"
                  : "Тренировка"}
            </p>
          </div>
          <div className="push toolbar">
            <button onClick={() => setMoving(e)}>Перенести</button>
            <button
              onClick={() => {
                if (confirm("Отменить это занятие?"))
                  void run(() => exception(e, null));
              }}
            >
              Отменить
            </button>
          </div>
        </article>
      ))}
      {!selected.length && (
        <Empty title="День без планов">
          Запланируйте тренировку или оставьте время для восстановления.
        </Empty>
      )}
      {adding && (
        <Modal title="Запланировать тренировку" close={() => setAdding(false)}>
          <Form
            onSave={async (data) => {
              const date = val(data, "date"),
                time = val(data, "time"),
                timeZoneId = val(data, "zone"),
                routineId = val(data, "routine");
              if (!routineId) throw new Error("Сначала создайте программу");
              if (data.get("repeat"))
                await save(owner, "calendar_rule", crypto.randomUUID(), {
                  routineId,
                  isoDay: Temporal.PlainDate.from(date).dayOfWeek,
                  localTime: time,
                  timeZoneId,
                  startLocalDate: date,
                  legacyRuleKey: null,
                });
              else
                await save(owner, "calendar_plan", crypto.randomUUID(), {
                  routineId,
                  startsAtMillis: resolveTime(date, time, timeZoneId),
                  timeZoneId,
                  legacyScheduleId: null,
                });
              setDay(date);
              setAdding(false);
            }}
          >
            <Field label="Программа">
              <select name="routine" required>
                {routines.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.payload!.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Дата">
              <input
                name="date"
                type="date"
                min="1970-01-01"
                max="2100-12-31"
                required
                defaultValue={day}
              />
            </Field>
            <Field label="Время">
              <input name="time" type="time" required defaultValue="18:00" />
            </Field>
            <Field label="Часовой пояс">
              <input name="zone" required defaultValue={zone()} />
            </Field>
            <label className="checkbox">
              <input type="checkbox" name="repeat" />
              Повторять каждую неделю
            </label>
          </Form>
        </Modal>
      )}
      {moving && (
        <Modal title="Перенести занятие" close={() => setMoving(null)}>
          <Form
            onSave={async (data) => {
              await exception(
                moving,
                resolveTime(val(data, "date"), val(data, "time"), zone()),
              );
              setMoving(null);
            }}
          >
            <Field label="Дата">
              <input type="date" name="date" required defaultValue={day} />
            </Field>
            <Field label="Время">
              <input type="time" name="time" required defaultValue="18:00" />
            </Field>
          </Form>
        </Modal>
      )}
    </>
  );
}
