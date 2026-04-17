export * from "./adapters/index.js";
export * from "./storage/index.js";

export function registerPlugin(): { name: string } {
  return { name: "@paperclipai/plugin-connect-tools" };
}
