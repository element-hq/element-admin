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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    intl: undefined!,
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
