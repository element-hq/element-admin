import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { H1, H3, Separator, Text } from "@vector-im/compound-web";
import { FormattedMessage } from "react-intl";

import { wellKnownQuery } from "@/api/matrix";
import { serverVersionQuery } from "@/api/synapse";

export const Route = createFileRoute("/_console/")({
  loader: async ({ context: { queryClient, credentials, intl } }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    await queryClient.ensureQueryData(serverVersionQuery(synapseRoot));

    return {
      title: intl.formatMessage({
        id: "pages.dashboard.title",
        defaultMessage: "Dashboard",
        description: "The title of the dashboard page",
      }),
    };
  },
  component: RouteComponent,
});

const Data: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => (
  <section className="flex flex-col gap-2">{children}</section>
);

const DataTitle: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => (
  <Text as="h4" weight="medium" className="text-text-secondary">
    {children}
  </Text>
);

function RouteComponent() {
  const { credentials } = Route.useRouteContext();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );

  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const { data } = useSuspenseQuery(serverVersionQuery(synapseRoot));

  return (
    <div className="flex flex-col gap-8">
      <H1>
        <FormattedMessage
          id="pages.dashboard.title"
          defaultMessage="Dashboard"
          description="The title of the dashboard page"
        />
      </H1>

      <section className="flex flex-col gap-6">
        <div>
          <H3>{credentials.serverName}</H3>
          <Separator kind="section" />
        </div>
        <Data>
          <DataTitle>
            <FormattedMessage
              id="pages.dashboard.synapse_version"
              defaultMessage="Synapse version"
              description="On the dashboard, this shows the Synapse version"
            />
          </DataTitle>
          <Text>{data.server_version}</Text>
        </Data>
      </section>
    </div>
  );
}
