import {
  checkoutErrorPayload,
  createStripeCheckout,
} from "../server/checkout-core.js";

function sendJson(response, status, payload) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  return response.status(status).json(payload);
}

function parseBody(request) {
  const body = request.body && typeof request.body === "object"
    ? request.body
    : typeof request.body === "string" ? JSON.parse(request.body) : null;
  if (!body || Array.isArray(body) || JSON.stringify(body).length > 12_000) {
    throw new Error("invalid_payload");
  }
  return body;
}

function requestHost(request) {
  return String(request.headers["x-forwarded-host"] ?? request.headers.host ?? "")
    .split(",")[0]
    .trim();
}

function requestOrigin(request) {
  const sentOrigin = String(request.headers.origin ?? "").trim();
  if (sentOrigin) return sentOrigin;
  const protocol = String(request.headers["x-forwarded-proto"] ?? "https").split(",")[0].trim();
  return `${protocol}://${requestHost(request)}`;
}

function originIsAllowed(request) {
  const origin = String(request.headers.origin ?? "").trim();
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    if (originUrl.host === requestHost(request)) return true;
    return String(process.env.ARCANE911_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .includes(originUrl.origin);
  } catch {
    return false;
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "method_not_allowed" });
  }
  if (!originIsAllowed(request)) return sendJson(response, 403, { error: "origin_not_allowed" });

  let body;
  try {
    body = parseBody(request);
  } catch {
    return sendJson(response, 400, { error: "invalid_payload" });
  }

  console.info("checkout_request_started", {
    productId: String(body.productId ?? "").slice(0, 80),
    orderId: String(body.orderId ?? "").slice(0, 120),
  });

  try {
    const result = await createStripeCheckout(body, { origin: requestOrigin(request) });
    console.info("checkout_request_completed", {
      productId: result.productId,
      orderId: result.orderId,
    });
    return sendJson(response, 200, result);
  } catch (error) {
    const failure = checkoutErrorPayload(error);
    console.error("checkout_request_failed", {
      productId: String(body.productId ?? "").slice(0, 80),
      orderId: String(body.orderId ?? "").slice(0, 120),
      type: failure.body.error,
      status: failure.status,
    });
    return sendJson(response, failure.status, failure.body);
  }
}
