export * from "./identity/index.js";
export * from "./bank/index.js";
export * from "./email/index.js";

export function registerPlugin(): {
  name: string;
} {
  return { name: "@paperclipai/plugin-identity" };
}
