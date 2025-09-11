import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@vector-im/compound-web";
import { StrictMode, Suspense } from "react";
import { preload } from "react-dom";

import { Toaster } from "@/components/toast";
import { IntlProvider, RouterWithIntl } from "@/intl";
import { queryClient } from "@/query";
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
              <RouterWithIntl />
            </TooltipProvider>
            <Toaster />
          </IntlProvider>
        </QueryClientProvider>
      </Suspense>
    </StrictMode>
  );
}
