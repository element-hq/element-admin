// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { createBrowserHistory, createRouter } from "@tanstack/react-router";

import { queryClient } from "@/query";
// Import the generated route tree
import { routeTree } from "@/routeTree.gen";

const history = createBrowserHistory();

// Create a new router instance
export const router = createRouter({
  routeTree,
  history,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
