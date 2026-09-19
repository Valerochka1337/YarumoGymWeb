import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Dumbbell,
  LockKeyhole,
  Minus,
  Plus,
  TimerReset,
  Trophy,
} from "lucide-react";
import { completedCount, currentPosition, remainingRest } from "./trialReducer";
import type {
  Actual,
  ExerciseType,
  Preview,
  PreviewSet,
  SetState,
  TrialState,
} from "./types";

const apk =
  "https://github.com/Valerochka1337/YarumoGymAndroid/releases/latest";

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function typeName(type: ExerciseType) {
  return type === "STRENGTH"
    ? "Силовое"
    : type === "TIMED"
      ? "На время"
      : "Кардио";
}

function setValues(type: ExerciseType, values: PreviewSet | Actual) {
  if (type === "STRENGTH")
    return `${values.weightKg ?? "—"} кг × ${values.reps ?? "—"}`;
  if (type === "TIMED") return `${values.durationSec ?? "—"} сек`;
  return [
    values.speedKmh == null ? null : `${values.speedKmh} км/ч`,
    values.inclinePct == null ? null : `наклон ${values.inclinePct}%`,
    values.durationSec == null ? null : `${values.durationSec} сек`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function PreviewScreen({
  state,
  onStart,
  onReset,
}: {
  state: TrialState;
  onStart: () => void;
  onReset: () => void;
}) {
  const setTotal = state.preview.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.length,
    0,
  );
  return (
    <section className="trial-preview" aria-labelledby="preview-title">
      <div className="trial-preview-hero">
        <div>
          <p className="trial-eyebrow">Yarumo · программа тренировки</p>
          <h1 id="preview-title">{state.preview.title}</h1>
          <div className="trial-preview-facts">
            <span>
              <Clock3 aria-hidden="true" />≈{" "}
              {Math.ceil(state.preview.estimatedDurationSeconds / 60)} мин.
            </span>
            <span>
              <Dumbbell aria-hidden="true" />
              {state.preview.exercises.length} упр. · {setTotal} подх.
            </span>
          </div>
        </div>
        <div className="trial-lock">
          <LockKeyhole aria-hidden="true" />
          Программа зафиксирована
        </div>
      </div>
      <div className="trial-preview-list">
        {state.preview.exercises.map((exercise, exerciseIndex) => (
          <article
            className="trial-preview-exercise"
            key={exercise.exerciseKey}
          >
            <div className="trial-exercise-number">{exerciseIndex + 1}</div>
            <div className="trial-preview-exercise-body">
              <h2>{exercise.name}</h2>
              <p>
                {typeName(exercise.type)} · отдых {exercise.restSeconds} с
              </p>
              <div className="trial-preview-sets">
                {exercise.sets.map((set, setIndex) => (
                  <span key={setIndex}>
                    Подход {setIndex + 1}
                    <strong>{setValues(exercise.type, set)}</strong>
                  </span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
      {state.revoked && (
        <p role="alert" className="trial-error">
          Ссылка отозвана: локальные итоги можно посмотреть, но начать или
          сохранить нельзя.
        </p>
      )}
      <div className="trial-preview-actions">
        <button
          className="trial-primary"
          disabled={state.revoked || setTotal === 0}
          onClick={onStart}
        >
          Начать тренировку
        </button>
        {state.startedAt > 0 && (
          <button className="trial-text-button" onClick={onReset}>
            Начать заново
          </button>
        )}
      </div>
      <a className="trial-download-link" href={apk}>
        Скачать Yarumo
      </a>
      <p className="trial-hint">
        Черновик сохраняется на этом устройстве. Структуру программы нельзя
        менять, но фактический вес, повторы и время можно отмечать по ходу
        тренировки.
      </p>
    </section>
  );
}

type ActiveProps = {
  state: TrialState;
  now: number;
  onActual: (exerciseIndex: number, setIndex: number, actual: Actual) => void;
  onComplete: (exerciseIndex: number, setIndex: number) => void;
  onAdjustRest: (seconds: number) => void;
  onSkip: () => void;
  onFinish: () => void;
  onClearError: () => void;
};

export function ActiveScreen({
  state,
  now,
  onActual,
  onComplete,
  onAdjustRest,
  onSkip,
  onFinish,
  onClearError,
}: ActiveProps) {
  const current = currentPosition(state);
  const complete = completedCount(state);
  const total = state.exercises.flat().length;
  const rest = remainingRest(state.restDeadlineAt, now);
  const exerciseNumber = current
    ? current.exerciseIndex + 1
    : state.preview.exercises.length;
  const elapsed = Math.max(0, Math.floor((now - state.startedAt) / 1000));

  return (
    <section className="trial-workout" aria-labelledby="workout-title">
      <header className="trial-workout-header">
        <div className="trial-workout-title-row">
          <div>
            <p className="trial-eyebrow">Пробная тренировка</p>
            <h1 id="workout-title">{state.preview.title}</h1>
          </div>
          <button
            className="trial-text-button trial-finish-early"
            onClick={onFinish}
          >
            Завершить
          </button>
        </div>
        <div className="trial-workout-status">
          <strong>
            <Clock3 aria-hidden="true" />
            {formatClock(elapsed)}
          </strong>
          <span>
            упражнение {exerciseNumber} из {state.preview.exercises.length}
          </span>
        </div>
        <div className="trial-progress-label">
          <span>Прогресс тренировки</span>
          <strong>
            {complete}/{total} подходов
          </strong>
        </div>
        <progress
          className="trial-progress"
          max={Math.max(1, total)}
          value={complete}
          aria-label={`Выполнено ${complete} из ${total} подходов`}
        />
        <div className="trial-lock">
          <LockKeyhole aria-hidden="true" />
          Структура тренировки защищена
        </div>
      </header>

      {state.error && (
        <div role="alert" className="trial-error trial-workout-error">
          <span>{state.error}</span>
          <button
            type="button"
            aria-label="Закрыть сообщение"
            onClick={onClearError}
          >
            ×
          </button>
        </div>
      )}

      <div className="trial-exercise-list">
        {state.preview.exercises.map((exercise, exerciseIndex) => (
          <ExerciseProgress
            key={exercise.exerciseKey}
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            sets={state.exercises[exerciseIndex]}
            activeSetIndex={
              current?.exerciseIndex === exerciseIndex ? current.setIndex : null
            }
            onActual={(actual) =>
              current && onActual(exerciseIndex, current.setIndex, actual)
            }
          />
        ))}
      </div>

      <div className="trial-action-spacer" aria-hidden="true" />
      <footer className="trial-workout-action">
        <div className="trial-action-inner">
          {rest > 0 ? (
            <div
              className="trial-rest-pill"
              aria-label={`Отдых ${formatClock(rest)}`}
            >
              <button
                onClick={() => onAdjustRest(-15)}
                aria-label="Убавить отдых на 15 секунд"
              >
                −15с
              </button>
              <button
                className="trial-rest-center"
                onClick={onSkip}
                aria-label="Пропустить отдых"
              >
                <strong>
                  <TimerReset aria-hidden="true" />
                  {formatClock(rest)}
                </strong>
                <small>пропустить отдых</small>
              </button>
              <button
                onClick={() => onAdjustRest(15)}
                aria-label="Добавить 15 секунд отдыха"
              >
                +15с
              </button>
            </div>
          ) : current ? (
            <button
              className="trial-primary trial-complete-set"
              onClick={() =>
                onComplete(current.exerciseIndex, current.setIndex)
              }
            >
              <Check aria-hidden="true" />
              Подход выполнен
            </button>
          ) : (
            <button
              className="trial-primary trial-complete-set"
              onClick={onFinish}
            >
              <Trophy aria-hidden="true" />
              Завершить тренировку
            </button>
          )}
        </div>
      </footer>
    </section>
  );
}

function ExerciseProgress({
  exercise,
  exerciseIndex,
  sets,
  activeSetIndex,
  onActual,
}: {
  exercise: Preview["exercises"][number];
  exerciseIndex: number;
  sets: SetState[];
  activeSetIndex: number | null;
  onActual: (actual: Actual) => void;
}) {
  const isCurrent = activeSetIndex !== null;
  const done = sets.filter((set) => set.completed).length;
  const [expanded, setExpanded] = useState(isCurrent);
  useEffect(() => {
    if (isCurrent) setExpanded(true);
  }, [isCurrent]);
  return (
    <article
      className={`trial-exercise-card ${isCurrent ? "is-current" : ""} ${done === sets.length ? "is-complete" : ""}`}
    >
      <div className="trial-exercise-heading">
        <div className="trial-exercise-number">
          {done === sets.length && sets.length > 0 ? (
            <CircleCheck aria-hidden="true" />
          ) : (
            exerciseIndex + 1
          )}
        </div>
        <div>
          <h2>{exercise.name}</h2>
          <p>
            {typeName(exercise.type)} · отдых {exercise.restSeconds} с
          </p>
        </div>
      </div>
      <button
        className="trial-sets-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span>
          Подходы: {done}/{sets.length}
        </span>
        <ChevronDown aria-hidden="true" />
      </button>
      {expanded && (
        <div className="trial-set-list">
          {sets.map((set, setIndex) =>
            activeSetIndex === setIndex ? (
              <CurrentSet
                key={setIndex}
                type={exercise.type}
                set={set}
                index={setIndex}
                onChange={onActual}
              />
            ) : (
              <div
                className={`trial-set-pill ${set.completed ? "is-complete" : ""}`}
                key={setIndex}
              >
                <span>
                  {set.completed && <Check aria-hidden="true" />}Подход{" "}
                  {setIndex + 1}
                </span>
                <strong>
                  {setValues(
                    exercise.type,
                    set.completed ? set.actual : exercise.sets[setIndex],
                  )}
                </strong>
              </div>
            ),
          )}
        </div>
      )}
    </article>
  );
}

function CurrentSet({
  type,
  set,
  index,
  onChange,
}: {
  type: ExerciseType;
  set: SetState;
  index: number;
  onChange: (actual: Actual) => void;
}) {
  const update = (key: keyof Actual, value: number | null) =>
    onChange({ ...set.actual, [key]: value });
  return (
    <div className="trial-current-set">
      <strong className="trial-current-label">ПОДХОД {index + 1}</strong>
      {type === "STRENGTH" && (
        <>
          <Stepper
            label="кг"
            value={set.actual.weightKg}
            step={2.5}
            min={0}
            onChange={(value) => update("weightKg", value)}
          />
          <Stepper
            label="повторы"
            value={set.actual.reps}
            step={1}
            min={0}
            integer
            onChange={(value) => update("reps", value)}
          />
        </>
      )}
      {type === "TIMED" && (
        <Stepper
          label="секунды"
          value={set.actual.durationSec}
          step={5}
          min={0}
          integer
          onChange={(value) => update("durationSec", value)}
        />
      )}
      {type === "CARDIO" && (
        <>
          <Stepper
            label="км/ч"
            value={set.actual.speedKmh}
            step={0.5}
            min={0}
            onChange={(value) => update("speedKmh", value)}
          />
          <Stepper
            label="наклон %"
            value={set.actual.inclinePct}
            step={0.5}
            min={-100}
            onChange={(value) => update("inclinePct", value)}
          />
          <Stepper
            label="секунды"
            value={set.actual.durationSec}
            step={5}
            min={0}
            integer
            onChange={(value) => update("durationSec", value)}
          />
        </>
      )}
    </div>
  );
}

function Stepper({
  label,
  value,
  step,
  min,
  integer = false,
  onChange,
}: {
  label: string;
  value: number | null;
  step: number;
  min: number;
  integer?: boolean;
  onChange: (value: number | null) => void;
}) {
  const shift = (direction: number) => {
    const base = value ?? 0;
    const next = Math.max(min, base + step * direction);
    onChange(integer ? Math.round(next) : Math.round(next * 10) / 10);
  };
  return (
    <label className="trial-stepper">
      <span className="sr-only">{label}</span>
      <button
        type="button"
        onClick={() => shift(-1)}
        aria-label={`Уменьшить ${label}`}
      >
        <Minus aria-hidden="true" />
      </button>
      <span className="trial-stepper-input">
        <input
          type="number"
          aria-label={label}
          min={min}
          step={step}
          inputMode="decimal"
          value={value ?? ""}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        />
        <small>{label}</small>
      </span>
      <button
        type="button"
        onClick={() => shift(1)}
        aria-label={`Увеличить ${label}`}
      >
        <Plus aria-hidden="true" />
      </button>
    </label>
  );
}

export function Summary({
  state,
  completed,
  onSave,
  onBack,
}: {
  state: TrialState;
  completed: number;
  onSave: () => void;
  onBack: () => void;
}) {
  const duration = Math.max(
    0,
    Math.round(
      ((state.finishedAt ?? state.startedAt) - state.startedAt) / 60000,
    ),
  );
  const facts = state.exercises.flatMap((sets, exerciseIndex) =>
    sets.flatMap((set, setIndex) =>
      set.completed ? [{ exerciseIndex, setIndex, set }] : [],
    ),
  );
  return (
    <section className="trial-summary" aria-labelledby="summary-title">
      <div className="trial-summary-icon">
        <Trophy aria-hidden="true" />
      </div>
      <p className="trial-eyebrow">Тренировка завершена</p>
      <h1 id="summary-title" tabIndex={-1}>
        Отличная работа!
      </h1>
      <div className="trial-summary-stats">
        <span>
          <strong>{duration}</strong>минут
        </span>
        <span>
          <strong>{completed}</strong>подходов
        </span>
      </div>
      <div className="trial-summary-list">
        {facts.map(({ exerciseIndex, setIndex, set }) => (
          <div key={`${exerciseIndex}-${setIndex}`}>
            <CircleCheck aria-hidden="true" />
            <span>
              {state.preview.exercises[exerciseIndex].name}
              <small>
                Подход {setIndex + 1} ·{" "}
                {setValues(
                  state.preview.exercises[exerciseIndex].type,
                  set.actual,
                )}
              </small>
            </span>
          </div>
        ))}
      </div>
      <div className="trial-save-card">
        <h2>Сохраните прогресс в Yarumo</h2>
        <p>
          После входа программа и результаты появятся в приложении в вашем
          аккаунте.
        </p>
        <button
          className="trial-primary"
          disabled={state.revoked || completed === 0}
          onClick={onSave}
        >
          {state.pendingSaveRequest
            ? "Повторить сохранение"
            : "Сохранить результаты"}
        </button>
      </div>
      {!state.pendingSaveRequest && (
        <button className="trial-text-button" onClick={onBack}>
          Вернуться к тренировке
        </button>
      )}
      {state.revoked && (
        <p role="alert" className="trial-error">
          Сохранение заблокировано: ссылка отозвана.
        </p>
      )}
    </section>
  );
}

export function Saved() {
  return (
    <section className="trial-saved" aria-labelledby="saved-title">
      <div className="trial-summary-icon">
        <CircleCheck aria-hidden="true" />
      </div>
      <h1 id="saved-title" tabIndex={-1}>
        Результаты сохранены
      </h1>
      <p>
        Программа и завершённая тренировка появятся в Yarumo после входа в тот
        же аккаунт.
      </p>
      <a className="trial-primary trial-button-link" href={apk}>
        Скачать Yarumo
      </a>
    </section>
  );
}

export function Unavailable({ title }: { title: string }) {
  return (
    <main className="trial-shell trial-centered">
      <section className="trial-empty">
        <h1>{title}</h1>
        <p>Проверьте ссылку или попросите автора отправить новую.</p>
      </section>
    </main>
  );
}
