import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { TooltipProvider } from "@vector-im/compound-web";
import { StrictMode, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { useIntl } from "react-intl";

import { queryClient, router } from "@/router";
import { IntlProvider } from "@/intl";
import "@/styles.css";

Sentry.init({
  // @ts-ignore
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
  tracesSampleRate: 1.0,
});

const RouterWithIntl = () => {
  const intl = useIntl();
  return <RouterProvider router={router} context={{ intl }} />;
};

// Render the app
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement, {
    // @ts-ignore
    onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
      console.warn("Uncaught error", error, errorInfo.componentStack);
    }),
    // @ts-ignore
    onCaughtError: Sentry.reactErrorHandler(),
    onRecoverableError: Sentry.reactErrorHandler(),
  });

  root.render(
    <StrictMode>
      {/* TODO: better fallback */}
      <Suspense fallback={"Loading…"}>
        <QueryClientProvider client={queryClient}>
          <IntlProvider>
            <TooltipProvider>
              <RouterWithIntl />
            </TooltipProvider>
          </IntlProvider>
        </QueryClientProvider>
      </Suspense>
    </StrictMode>,
  );
}
