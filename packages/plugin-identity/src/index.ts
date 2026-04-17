export * from "./identity/index.js";

export function registerPlugin(): {
  name: string;
} {
  return { name: "@paperclipai/plugin-identity" };
}
