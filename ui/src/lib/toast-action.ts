/**
 * Lightweight action feedback — used for buttons that don't have a backend yet.
 * Phase 2 replaces these with real API calls.
 */
export function comingSoon(feature: string) {
  // Use the native alert for now — swap for a toast component later
  alert(`${feature} — coming soon in Phase 2`);
}

export function actionSuccess(message: string) {
  alert(message);
}
