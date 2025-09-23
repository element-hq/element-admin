// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { useLayoutEffect } from "react";
import { defineMessage, useIntl } from "react-intl";

import { GenericError } from "@/ui/errors";
import {
  formatBreadcrumbs,
  useBreadcrumbsFromMatches,
} from "@/utils/breadcrumbs";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  staticData: {
    breadcrumb: {
      message: defineMessage({
        id: "product.title",
        defaultMessage: "Element Admin",
        description: "The main name of the admin console",
      }),
    },
  },

  component: RouteComponent,
  errorComponent: GenericError,
});

function RouteComponent() {
  const intl = useIntl();
  const breadcrumbs = useBreadcrumbsFromMatches();

  useLayoutEffect(() => {
    if (document) {
      // Remove the existing title tag from the initial HTML
      document.querySelector("title[data-temp-title]")?.remove();
    }
  }, []);

  return (
    <>
      <title>{formatBreadcrumbs(intl, breadcrumbs)}</title>
      <Outlet />
    </>
  );
}
