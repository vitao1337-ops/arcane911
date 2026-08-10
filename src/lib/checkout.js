export function isCheckoutConfigured(checkoutUrl) {
  return /^https?:\/\//i.test(String(checkoutUrl ?? "").trim());
}

export function buildCheckoutUrl(checkoutUrl, payload = {}) {
  if (!isCheckoutConfigured(checkoutUrl)) return "";

  const url = new URL(checkoutUrl);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

export function trackCommercialEvent(eventName, payload = {}) {
  if (typeof window === "undefined") return;

  const event = {
    event: eventName,
    product: "arcane911",
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(event);
  }

  window.dispatchEvent(
    new CustomEvent("arcane911:commercial-event", {
      detail: event,
    }),
  );
}
