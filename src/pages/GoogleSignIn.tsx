import { useRef, useState } from "react";
import { webAuth } from "../core/auth";
import { db } from "../core/db";
import { useApp } from "../ui";
let script: Promise<void> | undefined;
export function GoogleSignIn({
  signedIn,
}: {
  signedIn: (owner: string) => Promise<void>;
}) {
  const host = useRef<HTMLDivElement>(null),
    { run, owner } = useApp(),
    [ready, setReady] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  return (
    <div>
      <button
        onClick={() =>
          void run(async () => {
            if (await db.active.get(owner))
              throw new Error("Завершите тренировку перед входом");
            if (!script)
              script = new Promise<void>((resolve, reject) => {
                const s = document.createElement("script");
                s.src = "https://accounts.google.com/gsi/client";
                s.async = true;
                s.onload = () => resolve();
                s.onerror = () => {
                  script = undefined;
                  reject(new Error("Не удалось загрузить вход Google"));
                };
                document.head.append(s);
              });
            await script;
            const { nonce } = await webAuth("google/nonce");
            const google = (window as any).google;
            google.accounts.id.initialize({
              client_id: clientId,
              nonce,
              auto_select: false,
              callback: (response: { credential: string }) =>
                void run(async () => {
                  if (await db.active.get(owner))
                    throw new Error("Завершите тренировку перед входом");
                  const session = await webAuth("google", {
                    idToken: response.credential,
                    nonce,
                    deviceName: "Yarumo Web",
                  });
                  await signedIn(session.userId);
                }),
            });
            google.accounts.id.renderButton(host.current, {
              theme: "outline",
              size: "large",
              text: "signin_with",
              locale: "ru",
            });
            setReady(true);
          })
        }
        hidden={ready}
      >
        Войти через Google
      </button>
      <div ref={host} />
    </div>
  );
}
