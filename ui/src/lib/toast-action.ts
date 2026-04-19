/**
 * Lightweight action feedback — used for buttons that don't have a backend yet.
 * Shows a non-blocking toast in the bottom-right corner.
 */

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, type: "info" | "success" = "info") {
  // Remove existing toast
  const existing = document.getElementById("company-dev-toast");
  if (existing) existing.remove();
  if (toastTimeout) clearTimeout(toastTimeout);

  const toast = document.createElement("div");
  toast.id = "company-dev-toast";
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    padding: 12px 20px; border-radius: 12px; font-size: 13px;
    font-family: system-ui, sans-serif; max-width: 360px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    transition: opacity 0.3s, transform 0.3s;
    opacity: 0; transform: translateY(8px);
    ${type === "success"
      ? "background: #000; color: #fff;"
      : "background: #fff; color: #1a1a1a; border: 1px solid #e5e5e5;"
    }
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  toastTimeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function comingSoon(feature: string) {
  showToast(`${feature} — coming soon`);
}

export function actionSuccess(message: string) {
  showToast(message, "success");
}
