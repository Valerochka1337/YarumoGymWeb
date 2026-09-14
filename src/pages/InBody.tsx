import { useState } from "react";
import { apiJson, currentSession } from "../core/auth";
import { freshContext } from "../core/actions";
import { save } from "../core/db";
import { zone, resolveTime, localDate } from "../core/calendar";
import { useApp, Field, Form, val, num, Modal } from "../ui";
const labels: Record<string, string> = {
  weightKg: "Вес, кг",
  skeletalMuscleMassKg: "Скелетная мышечная масса, кг",
  bodyFatPercentage: "Жир, %",
  bodyFatMassKg: "Жировая масса, кг",
  waistHipRatio: "Талия / бёдра",
  totalBodyWaterLiters: "Вода, л",
  proteinKg: "Белок, кг",
  mineralsKg: "Минералы, кг",
  bodyMassIndex: "Индекс массы тела",
  fatFreeMassKg: "Безжировая масса, кг",
  visceralFatLevel: "Висцеральный жир",
  inBodyScore: "Оценка InBody",
  basalMetabolicRateKcal: "Основной обмен, ккал",
  recommendedCalorieIntakeKcal: "Рекомендуемые калории, ккал",
};
export function InBody() {
  const { owner, message } = useApp(),
    [draft, setDraft] = useState<any>();
  if (owner === "guest" || !currentSession()) return null;
  return (
    <section className="card">
      <h2>InBody по фотографии</h2>
      <Form
        onSave={async (data) => {
          const file = data.get("photo");
          if (!(file instanceof File) || !file.size)
            throw new Error("Выберите фотографию");
          if (
            !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
            file.size > 5 * 1024 * 1024
          )
            throw new Error("Нужна фотография JPEG, PNG или WebP до 5 МБ");
          if (!data.has("consent"))
            throw new Error("Подтвердите передачу фотографии");
          const headers = { "X-Gym-Capabilities": "health-ledger-v1" };
          let consent = await apiJson("/health-ai-disclosure", { headers });
          if (!consent.enabled || consent.noticeVersion !== 1)
            consent = await apiJson("/health-ai-disclosure", {
              method: "POST",
              headers,
              body: JSON.stringify({
                operationId: crypto.randomUUID(),
                baseRevision: consent.revision,
                noticeVersion: 1,
                enabled: true,
              }),
            });
          const context = await freshContext(owner);
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () =>
              reject(new Error("Не удалось прочитать фотографию"));
            reader.readAsDataURL(file);
          });
          const result = await apiJson("/ai/inbody-drafts", {
            method: "POST",
            headers: {
              "X-Health-AI-Disclosure-Revision": String(consent.revision),
            },
            body: JSON.stringify({
              requestId: crypto.randomUUID(),
              ...context,
              image: { mediaType: file.type, base64 },
            }),
          });
          setDraft(result.result.draft);
        }}
      >
        <Field label="Фото отчёта">
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" name="consent" required />
          Разрешаю передать фотографию отчёта и содержащиеся в ней сведения о
          теле серверному AI-провайдеру для распознавания.
        </label>
      </Form>
      {draft && (
        <Modal
          title="Проверьте распознанные замеры"
          close={() => setDraft(undefined)}
        >
          <Form
            onSave={async (data) => {
              const payload: Record<string, any> = {
                measuredAt: resolveTime(
                  val(data, "date"),
                  val(data, "time"),
                  zone(),
                ),
              };
              for (const k of Object.keys(labels)) payload[k] = num(data, k);
              for (const [key, prefix] of Object.entries({
                LEFT_ARM: "leftArm",
                RIGHT_ARM: "rightArm",
                TRUNK: "trunk",
                LEFT_LEG: "leftLeg",
                RIGHT_LEG: "rightLeg",
              })) {
                for (const [source, suffix] of Object.entries({
                  leanMassKg: "LeanMassKg",
                  leanPercentage: "LeanPercentage",
                  fatMassKg: "FatMassKg",
                  fatPercentage: "FatPercentage",
                })) {
                  payload[prefix + suffix] = num(data, `${key}.${source}`);
                }
              }
              await save(owner, "measurement", crypto.randomUUID(), payload);
              setDraft(undefined);
              message("Замеры сохранены");
            }}
          >
            <Field label="Дата">
              <input
                name="date"
                type="date"
                required
                defaultValue={draft.measuredDate ?? localDate()}
              />
            </Field>
            <Field label="Время">
              <input
                name="time"
                type="time"
                required
                defaultValue={draft.measuredTime ?? "12:00"}
              />
            </Field>
            {Object.entries(labels).map(([k, l]) => (
              <Field key={k} label={l}>
                <input
                  name={k}
                  type="number"
                  min="0"
                  step={
                    [
                      "visceralFatLevel",
                      "inBodyScore",
                      "basalMetabolicRateKcal",
                      "recommendedCalorieIntakeKcal",
                    ].includes(k)
                      ? "1"
                      : "0.01"
                  }
                  max={k === "bodyFatPercentage" ? 100 : undefined}
                  defaultValue={draft[k] ?? ""}
                />
              </Field>
            ))}
            {Object.entries({
              LEFT_ARM: "Левая рука",
              RIGHT_ARM: "Правая рука",
              TRUNK: "Туловище",
              LEFT_LEG: "Левая нога",
              RIGHT_LEG: "Правая нога",
            }).map(([k, l]) => (
              <div key={k}>
                <h3>{l}</h3>
                {Object.entries({
                  leanMassKg: "Мышечная масса, кг",
                  leanPercentage: "Мышечная масса, %",
                  fatMassKg: "Жировая масса, кг",
                  fatPercentage: "Жировая масса, %",
                }).map(([field, label]) => (
                  <Field key={field} label={label}>
                    <input
                      name={`${k}.${field}`}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={draft.segments?.[k]?.[field] ?? ""}
                    />
                  </Field>
                ))}
              </div>
            ))}
          </Form>
        </Modal>
      )}
    </section>
  );
}
