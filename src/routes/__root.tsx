import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { H1 } from "@vector-im/compound-web";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <>
      <div className="h-full flex flex-col gap-20">
        <div className="border-b-2 border-b-bg-subtle-primary">
          <div className="container mx-auto flex items-center justify-between py-5">
            <H1>Admin Console</H1>
          </div>
        </div>
        <div className="container mx-auto">
          <Outlet />
        </div>
      </div>
      <TanStackRouterDevtools />
      <ReactQueryDevtools />
    </>
  );
}
