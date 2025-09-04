import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { IntlShape } from "react-intl";

import { GenericError } from "@/ui/errors";

interface RouterContext {
  queryClient: QueryClient;
  intl: IntlShape;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  loader: ({ context: { intl } }) => ({
    title: intl.formatMessage({
      id: "product.title",
      defaultMessage: "Element Server Suite",
      description: "The main name of the admin console",
    }),
  }),

  head: ({ loaderData }) => ({
    meta: [
      loaderData
        ? {
            title: loaderData.title,
          }
        : { title: "Loading Element Server Suite…" },
    ],
  }),

  component: RouteComponent,
  errorComponent: GenericError,
});

function RouteComponent() {
  return (
    <>
      <HeadContent />
      <Outlet />
      <TanStackRouterDevtools />
      <ReactQueryDevtools />
    </>
  );
}
