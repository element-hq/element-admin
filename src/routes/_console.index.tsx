import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { wellKnownQuery } from "@/api/matrix";
import { serverVersionQuery } from "@/api/synapse";

export const Route = createFileRoute("/_console/")({
  loader: async ({ context: { queryClient, credentials } }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    await queryClient.ensureQueryData(
      serverVersionQuery(queryClient, synapseRoot),
    );
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { credentials } = Route.useRouteContext();

  const queryClient = useQueryClient();
  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );

  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const { data } = useSuspenseQuery(
    serverVersionQuery(queryClient, synapseRoot),
  );

  return (
    <div className="space-y-4">
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
