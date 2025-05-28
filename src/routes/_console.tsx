import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { useAuthStore } from "@/stores/auth";

export const Route = createFileRoute("/_console")({
  beforeLoad: () => {
    const state = useAuthStore.getState();
    if (!state.credentials) {
      throw redirect({ to: "/login" });
    }

    return {
      credentials: state.credentials,
    };
  },

  component: () => (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="container">
        <Outlet />
      </div>
    </div>
  ),
});
