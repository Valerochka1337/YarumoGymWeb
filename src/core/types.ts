export type Payload = Record<string, any>;
export interface WireRecord {
  kind: string;
  id: string;
  revision: number;
  deleted: boolean;
  payload: Payload | null;
}
export interface LocalRecord extends WireRecord {
  key: string;
  owner: string;
  dirty: boolean;
  baseline: WireRecord | null;
  conflict?: WireRecord;
}
export interface Change {
  kind: string;
  id: string;
  baseRevision: number;
  deleted: boolean;
  payload: Payload | null;
}
export interface Packet {
  operationId: string;
  changes: Change[];
  catalogRevision?: number;
}
export interface Outbox {
  owner: string;
  body: string;
  sent: LocalRecord[];
}
export interface CatalogRecord {
  key: string;
  kind: string;
  id: string;
  revision: number;
  archived: boolean;
  payload: Payload;
}
export interface Active {
  owner: string;
  workoutId: string;
  restEndsAt: number | null;
}
export interface WorkoutSet {
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
  speedKmh: number | null;
  inclinePct: number | null;
  isCompleted: boolean;
  completedAt: number | null;
  [key: string]: unknown;
}
export const capabilities = [
  "calendar-plans",
  "annotated-workout-writes",
  "exercise-hint",
  "profile",
];
export const keyOf = (owner: string, kind: string, id: string) =>
  `${owner}:${kind}:${id}`;
export const asWire = ({
  kind,
  id,
  revision,
  deleted,
  payload,
}: WireRecord): WireRecord => ({ kind, id, revision, deleted, payload });
