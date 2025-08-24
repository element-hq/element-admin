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

  // Remove the existing <title> tag, as this is managed by Tanstack Router now
  const title = document.querySelector("title");
  if (title) {
    title.remove();
  }

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
