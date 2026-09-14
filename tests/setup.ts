import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});
Object.defineProperty(navigator, "locks", {
  value: { request: async (_name: string, fn: any) => fn({}) },
  configurable: true,
});
