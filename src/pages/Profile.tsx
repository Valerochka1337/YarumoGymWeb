import { useLiveQuery } from "dexie-react-hooks";
import { records, save } from "../core/db";
import { profileId } from "../core/identity";
import { useApp, Form, Field, val, num } from "../ui";
export function Profile() {
  const { owner, message } = useApp(),
    list = useLiveQuery(() => records(owner, "profile"), [owner]);
  if (!list) return null;
  const p = list[0]?.payload;
  return (
    <section className="card">
      <h2>О вас и ваших целях</h2>
      <Form
        key={`${owner}:${list[0]?.id ?? "new"}`}
        onSave={async (data) => {
          const id = profileId(owner);
          await save(owner, "profile", id, {
            schemaVersion: 1,
            syncId: id,
            updatedAt: Date.now(),
            trainingGoal: val(data, "goal") || null,
            sex: val(data, "sex") || null,
            birthDate: val(data, "birth") || null,
            experienceLevel: val(data, "experience") || null,
            plannedSessionsPerWeek: num(data, "sessions"),
            preferredSessionDurationMinutes: num(data, "duration"),
            manualConstraints: val(data, "constraints") || null,
            equipmentIds: p?.equipmentIds ?? [],
          });
          message("Профиль сохранён на устройстве.");
        }}
      >
        <Field label="Цель">
          <select name="goal" defaultValue={p?.trainingGoal ?? ""}>
            <option value="">Не указана</option>
            {Object.entries({
              STRENGTH: "Сила",
              MUSCLE_GAIN: "Мышечная масса",
              FAT_LOSS: "Снижение жировой массы",
              GENERAL_FITNESS: "Общая форма",
              ENDURANCE: "Выносливость",
              OTHER: "Другая",
            }).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Опыт">
          <select name="experience" defaultValue={p?.experienceLevel ?? ""}>
            <option value="">Не указан</option>
            <option value="BEGINNER">Начинающий</option>
            <option value="INTERMEDIATE">Средний</option>
            <option value="ADVANCED">Продвинутый</option>
          </select>
        </Field>
        <Field label="Пол">
          <select name="sex" defaultValue={p?.sex ?? ""}>
            <option value="">Не указан</option>
            <option value="FEMALE">Женский</option>
            <option value="MALE">Мужской</option>
            <option value="PREFER_NOT_TO_SAY">Не указывать</option>
          </select>
        </Field>
        <Field label="Дата рождения">
          <input
            type="date"
            name="birth"
            min="1900-01-01"
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={p?.birthDate ?? ""}
          />
        </Field>
        <Field label="Тренировок в неделю">
          <input
            type="number"
            min="1"
            max="7"
            step="1"
            name="sessions"
            defaultValue={p?.plannedSessionsPerWeek ?? ""}
          />
        </Field>
        <Field label="Длительность тренировки, мин">
          <input
            type="number"
            min="10"
            max="240"
            step="1"
            name="duration"
            defaultValue={p?.preferredSessionDurationMinutes ?? ""}
          />
        </Field>
        <Field label="Ограничения и пожелания">
          <textarea
            name="constraints"
            maxLength={2000}
            defaultValue={p?.manualConstraints ?? ""}
          />
        </Field>
      </Form>
    </section>
  );
}
