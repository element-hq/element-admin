import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    const state = useAuthStore.getState();
    if (state.credentials) {
      throw redirect({ to: "/" });
    }
  },

  component: () => {
    return (
      <div className="max-w-96 mx-auto">
        <div className="m-8 p-4 border border-border-interactive-primary rounded">
          <Outlet />
        </div>
      </div>
    );
  },
});
