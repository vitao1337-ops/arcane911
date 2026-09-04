import { timingSafeEqual } from "node:crypto";

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(status).json(payload);
}

function authorized(request) {
  const expected = String(process.env.ASTRO911_ADMIN_SECRET ?? "").trim();
  const received = String(request.headers.authorization ?? "").replace(/^Bearer\s+/iu, "").trim();
  if (expected.length < 24 || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }
  if (!authorized(request)) return sendJson(response, 401, { error: "unauthorized" });

  return sendJson(response, 410, {
    error: "endpoint_replaced",
    message: "Use /admin/mapas para anexar, aprovar e enviar o PDF com segurança.",
  });
}
