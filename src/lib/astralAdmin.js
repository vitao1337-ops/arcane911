const ADMIN_SECRET_KEY = "arcane911.astral-admin-secret.v1";

export function readAstralAdminSecret() {
  try { return window.sessionStorage.getItem(ADMIN_SECRET_KEY) || ""; } catch { return ""; }
}

export function storeAstralAdminSecret(value) {
  const secret = String(value ?? "").trim();
  try {
    if (secret) window.sessionStorage.setItem(ADMIN_SECRET_KEY, secret);
    else window.sessionStorage.removeItem(ADMIN_SECRET_KEY);
  } catch { /* A sessão atual ainda pode usar o segredo em memória. */ }
  return secret;
}

export async function requestAstralAdmin(secret, body, options = {}) {
  const response = await (options.fetchImplementation ?? globalThis.fetch)("/api/astral-admin", {
    method: "POST",
    credentials: "same-origin",
    headers: { Authorization: `Bearer ${String(secret ?? "").trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(payload?.error || "astral_admin_unavailable"));
    error.code = String(payload?.error || "astral_admin_unavailable");
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function pdfFileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File) || file.type !== "application/pdf") {
      reject(Object.assign(new Error("pdf_invalid"), { code: "pdf_invalid" }));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(Object.assign(new Error("pdf_read_failed"), { code: "pdf_read_failed" }));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}
