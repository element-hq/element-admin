import { QueryClient } from "@tanstack/react-query";

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
