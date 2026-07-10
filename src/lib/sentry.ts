import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
    beforeSend(event) {
      const headers = event.request?.headers as Record<string, unknown> | undefined;
      if (headers?.["x-forwarded-for"]) {
        delete headers["x-forwarded-for"];
      }
      return event;
    },
  });
}

export { Sentry };
