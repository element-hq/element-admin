import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

// Import the generated route tree
import { routeTree } from "@/routeTree.gen";

export const queryClient = new QueryClient();

// Create a new router instance
export const router = createRouter({
  routeTree,
  context: {
    queryClient,
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
