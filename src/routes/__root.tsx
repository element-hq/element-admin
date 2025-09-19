import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { IntlShape } from "react-intl";

import { GenericError } from "@/ui/errors";
import {
  formatBreadcrumbs,
  type WithBreadcrumbEntry,
} from "@/utils/breadcrumbs";

interface RouterContext {
  queryClient: QueryClient;
  intl: IntlShape;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  loader: ({ context: { intl } }) =>
    ({
      breadcrumb: {
        name: intl.formatMessage({
          id: "product.title",
          defaultMessage: "Element Admin",
          description: "The main name of the admin console",
        }),
      },
    }) satisfies WithBreadcrumbEntry,

  head: ({ matches }) => {
    const breadcrumbs = matches
      .map((match) => match.loaderData?.breadcrumb)
      .filter((breadcrumb) => breadcrumb !== undefined);

    if (breadcrumbs.length === 0) {
      return {
        meta: [
          {
            title: "Loading Element Admin…",
          },
        ],
      };
    }

    const title = formatBreadcrumbs(breadcrumbs);
    return {
      meta: [{ title }],
    };
  },

  component: RouteComponent,
  errorComponent: GenericError,
});

function RouteComponent() {
  return (
    <>
      <HeadContent />
      <Outlet />
    </>
  );
}
