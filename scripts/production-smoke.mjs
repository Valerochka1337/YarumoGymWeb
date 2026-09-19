import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("https://api.valerochkagym.tech/", {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "Время для себя" }).waitFor();
  await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SW timeout")), 15000),
      ),
    ]),
  );
  await page.reload();
  await page.getByRole("heading", { name: "Время для себя" }).waitFor();
  await page.screenshot({
    path: "test-results/production-home.png",
    fullPage: true,
  });
  const admin = await page.goto("https://api.valerochkagym.tech/admin/");
  if (admin.status() !== 200) throw new Error("Admin route failed");
  if (await page.getByRole("heading", { name: "Время для себя" }).count())
    throw new Error("SW intercepted admin");
  const health = await page.goto("https://api.valerochkagym.tech/health");
  if (
    health.status() !== 200 ||
    !(await page.locator("body").innerText()).includes("UP")
  )
    throw new Error("Health route failed");
  await page.goto("https://api.valerochkagym.tech/");
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Время для себя" }).waitFor();
  console.log(
    "PASS: published home, SW, admin bypass, health bypass, offline reload",
  );
} finally {
  await browser.close();
}
