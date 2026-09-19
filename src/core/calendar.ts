import { Temporal } from "@js-temporal/polyfill";
import type { LocalRecord } from "./types";
export const localDate = () => Temporal.Now.plainDateISO().toString();
export const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export function resolveTime(
  date: string,
  time: string,
  timeZone: string,
): number {
  const local = Temporal.PlainDateTime.from(`${date}T${time}`);
  const result = local.toZonedDateTime(timeZone, {
    disambiguation: "compatible",
  });
  if (!result.toPlainDateTime().equals(local)) {
    // Android chooses the first valid instant after a DST gap (03:00, not 03:30).
    const before = local.toZonedDateTime(timeZone, {
      disambiguation: "earlier",
    });
    const transition = before.getTimeZoneTransition("next");
    if (transition && transition.epochMilliseconds <= result.epochMilliseconds)
      return transition.epochMilliseconds;
  }
  return result.epochMilliseconds;
}
export interface Instance {
  id: string;
  at: number;
  routineId: string;
  planId?: string;
  ruleId?: string;
  instanceKey?: string;
  moved?: boolean;
}
export function instances(
  rows: LocalRecord[],
  start: string,
  end: string,
  displayZone = zone(),
): Instance[] {
  const from = resolveTime(start, "00:00", displayZone),
    until = resolveTime(
      Temporal.PlainDate.from(end).add({ days: 1 }).toString(),
      "00:00",
      displayZone,
    );
  if (
    Temporal.PlainDate.from(start).until(Temporal.PlainDate.from(end)).days >
      366 ||
    until <= from
  )
    throw new Error("Некорректный диапазон календаря");
  const all = rows.filter((r) => !r.deleted),
    result: Instance[] = [];
  for (const r of all.filter((r) => r.kind === "calendar_plan"))
    result.push({
      id: r.id,
      planId: r.id,
      at: r.payload!.startsAtMillis,
      routineId: r.payload!.routineId,
    });
  for (const r of all.filter((r) => r.kind === "calendar_rule")) {
    const p = r.payload!,
      changes = all.filter(
        (x) => x.kind === "calendar_exception" && x.payload?.ruleId === r.id,
      );
    let date = Temporal.Instant.fromEpochMilliseconds(from)
      .toZonedDateTimeISO(p.timeZoneId)
      .toPlainDate();
    const last = Temporal.Instant.fromEpochMilliseconds(until - 1)
      .toZonedDateTimeISO(p.timeZoneId)
      .toPlainDate();
    while (Temporal.PlainDate.compare(date, last) <= 0) {
      const key = `${date}T${p.localTime}[${p.timeZoneId}]`;
      if (
        date.dayOfWeek === p.isoDay &&
        date.toString() >= p.startLocalDate &&
        !changes.some((c) => c.payload!.instanceKey === key)
      )
        result.push({
          id: `${r.id}:${key}`,
          ruleId: r.id,
          instanceKey: key,
          routineId: p.routineId,
          at: resolveTime(date.toString(), p.localTime, p.timeZoneId),
        });
      date = date.add({ days: 1 });
    }
    for (const c of changes.filter((c) => c.payload!.kind === "MOVED"))
      result.push({
        id: c.id,
        ruleId: r.id,
        instanceKey: c.payload!.instanceKey,
        routineId: p.routineId,
        at: c.payload!.movedAtMillis,
        moved: true,
      });
  }
  return result
    .filter((r) => r.at >= from && r.at < until)
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
