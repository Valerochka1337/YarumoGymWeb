import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { X } from "lucide-react";
export const AppContext = createContext({
  owner: "guest",
  run: async (_action: () => Promise<unknown>) => {},
  message: (_text: string) => {},
});
export const useApp = () => useContext(AppContext);
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <dialog
      open
      ref={(node) => {
        if (node && !node.hasAttribute("data-modal")) {
          node.removeAttribute("open");
          node.showModal();
          node.setAttribute("data-modal", "true");
        }
      }}
      onCancel={close}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon" onClick={close} aria-label="Закрыть">
          <X />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Submit({
  children = "Сохранить",
  busy = false,
}: {
  children?: ReactNode;
  busy?: boolean;
}) {
  return (
    <button className="primary" disabled={busy} type="submit">
      {busy ? "Сохранение…" : children}
    </button>
  );
}
export function Form({
  onSave,
  children,
}: {
  onSave: (data: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    { run } = useApp();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    void run(() => onSave(data)).finally(() => setBusy(false));
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy}>
        {children}
        <Submit busy={busy} />
      </fieldset>
    </form>
  );
}
export const val = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
export const num = (data: FormData, key: string) =>
  val(data, key) === "" ? null : Number(val(data, key));
export const dateFormat = (n: number) =>
  new Date(n).toLocaleDateString("ru", { day: "numeric", month: "long" });
