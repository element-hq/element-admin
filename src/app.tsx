import { TanStackDevtools } from "@tanstack/react-devtools";
import { PacerDevtoolsPanel } from "@tanstack/react-pacer-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { RouterProvider } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TooltipProvider } from "@vector-im/compound-web";
import { StrictMode, Suspense } from "react";
import { preload } from "react-dom";

import { Toaster } from "@/components/toast";
import { IntlProvider } from "@/intl";
import { queryClient } from "@/query";
import { router } from "@/router";
import style from "@/styles.css?url";
import LoadingFallback from "@/ui/loading-fallback";

// Start pre-loading the style as soon as possible
preload(style, { as: "style" });

export function App() {
  return (
    <StrictMode>
      <Suspense fallback={<LoadingFallback />}>
        <link rel="stylesheet" href={style} />
        <QueryClientProvider client={queryClient}>
          <IntlProvider>
            <TooltipProvider>
              <RouterProvider router={router} />
            </TooltipProvider>
            <Toaster />
          </IntlProvider>
        </QueryClientProvider>
      </Suspense>

      <TanStackDevtools
        eventBusConfig={{ connectToServerBus: true }}
        plugins={[
          {
            name: "TanStack Query",
            render: <ReactQueryDevtoolsPanel client={queryClient} />,
          },
          {
            name: "TanStack Router",
            render: <TanStackRouterDevtoolsPanel router={router} />,
          },
          {
            name: "TanStack Pacer",
            render: (_element, theme) => <PacerDevtoolsPanel theme={theme} />,
          },
        ]}
      />
    </StrictMode>
  );
}
