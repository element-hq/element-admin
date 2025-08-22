import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@vector-im/compound-web";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

import { IntlProvider, RouterWithIntl } from "@/intl";
import { queryClient } from "@/router";
import "@/styles.css";

// Render the app
const rootElement = document.querySelector("#app");
if (rootElement && !rootElement.innerHTML) {
  const root = createRoot(rootElement);

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
