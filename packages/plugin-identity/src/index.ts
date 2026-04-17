export * from "./identity/index.js";
export * from "./bank/index.js";
export * from "./email/index.js";
export * from "./browser/index.js";
export * from "./domains/index.js";

export function registerPlugin(): {
  name: string;
} {
  return { name: "@paperclipai/plugin-identity" };
}
