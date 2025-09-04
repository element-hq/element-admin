import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "@/routeTree.gen";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoids re-fetching too often. Tanstack Query will usually refetch
      // whenever a component gets mounted. This keeps the query marked as
      // 'fresh' for 1 minute, so that we don't re-fetch too often.
      staleTime: 1 * 60 * 1000,
    },
  },
});

// Create a new router instance
export const router = createRouter({
  routeTree,
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
