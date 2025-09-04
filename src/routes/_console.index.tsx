import {
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { H3, Separator, Text } from "@vector-im/compound-web";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { defineMessage, FormattedMessage, FormattedNumber } from "react-intl";

import { registeredUsersCountQuery } from "@/api/mas";
import { wellKnownQuery } from "@/api/matrix";
import { roomsCountQuery, serverVersionQuery } from "@/api/synapse";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import AppNavigation from "@/ui/navigation";

const titleMessage = defineMessage({
  id: "pages.dashboard.title",
  defaultMessage: "Dashboard",
  description: "The title of the dashboard page",
});

export const Route = createFileRoute("/_console/")({
  loader: async ({ context: { queryClient, credentials, intl } }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );

    const synapseRoot = wellKnown["m.homeserver"].base_url;

    // Kick the loading of the 3 queries but don't await them
    queryClient.prefetchQuery(serverVersionQuery(synapseRoot));
    queryClient.prefetchQuery(roomsCountQuery(synapseRoot));
    queryClient.prefetchQuery(
      registeredUsersCountQuery(credentials.serverName),
    );

    return {
      title: intl.formatMessage(titleMessage),
    };
  },
  head: ({ loaderData }) => ({
    meta: [loaderData ? { title: loaderData.title } : {}],
  }),
  component: RouteComponent,
});

const Data: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => (
  <section className="flex flex-col gap-2">{children}</section>
);

const DataPlaceholder: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => {
  const resetQueryErrorBoundary = useQueryErrorResetBoundary();
  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <Text className="text-text-critical-primary flex gap-2 items-center">
          <ErrorIcon height="16px" width="16px" />
          <span>
            <FormattedMessage
              id="pages.dashboard.failed_to_load"
              description="On the dashboard, we display this message when a particular data value fails to load"
              defaultMessage="Failed to load"
            />
          </span>
          <button
            className="text-text-primary underline cursor-pointer font-semibold"
            onClick={resetErrorBoundary}
          >
            <FormattedMessage {...messages.actionRetry} />
          </button>
        </Text>
      )}
      onReset={() => resetQueryErrorBoundary.reset()}
    >
      <Suspense fallback={<Placeholder.Text />}>{children}</Suspense>
    </ErrorBoundary>
  );
};

const DataTitle: React.FC<React.PropsWithChildren> = ({
  children,
}: React.PropsWithChildren) => (
  <Text as="h4" weight="medium" className="text-text-secondary">
    {children}
  </Text>
);

interface SynapseVersionProps {
  synapseRoot: string;
}
const SynapseVersion: React.FC<SynapseVersionProps> = ({
  synapseRoot,
}: SynapseVersionProps) => {
  const { data } = useSuspenseQuery(serverVersionQuery(synapseRoot));
  return <Text>{data.server_version}</Text>;
};

interface RegisteredUsersProps {
  serverName: string;
}
const RegisteredUsers: React.FC<RegisteredUsersProps> = ({
  serverName,
}: RegisteredUsersProps) => {
  const { data } = useSuspenseQuery(registeredUsersCountQuery(serverName));
  return (
    <Text>
      <FormattedNumber value={data} />
    </Text>
  );
};

interface TotalRoomsProps {
  synapseRoot: string;
}
const TotalRooms: React.FC<TotalRoomsProps> = ({
  synapseRoot,
}: TotalRoomsProps) => {
  const { data } = useSuspenseQuery(roomsCountQuery(synapseRoot));
  return (
    <Text>
      <FormattedNumber value={data} />
    </Text>
  );
};

function RouteComponent() {
  const { credentials } = Route.useRouteContext();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );

  const synapseRoot = wellKnown["m.homeserver"].base_url;

  return (
    <Navigation.Root>
      <AppNavigation />

      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
          </Page.Header>

          <section className="flex flex-col gap-6">
            <div>
              <H3>{credentials.serverName}</H3>
              <Separator kind="section" />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,350px))] gap-4">
              <Data>
                <DataTitle>
                  <FormattedMessage
                    id="pages.dashboard.synapse_version"
                    defaultMessage="Synapse version"
                    description="On the dashboard, this shows the Synapse version"
                  />
                </DataTitle>
                <DataPlaceholder>
                  <SynapseVersion synapseRoot={synapseRoot} />
                </DataPlaceholder>
              </Data>

              <Data>
                <DataTitle>
                  <FormattedMessage
                    id="pages.dashboard.rooms_count"
                    defaultMessage="Rooms total"
                    description="On the dashboard, this shows the Synapse uptime"
                  />
                </DataTitle>
                <DataPlaceholder>
                  <TotalRooms synapseRoot={synapseRoot} />
                </DataPlaceholder>
              </Data>

              <Data>
                <DataTitle>
                  <FormattedMessage
                    id="pages.dashboard.registered_users_count"
                    defaultMessage="Users registered"
                    description="On the dashboard, this shows the number of users registered in MAS"
                  />
                </DataTitle>
                <DataPlaceholder>
                  <RegisteredUsers serverName={credentials.serverName} />
                </DataPlaceholder>
              </Data>
            </div>
          </section>
        </Navigation.Main>

        <AppFooter />
      </Navigation.Content>

      <Outlet />
    </Navigation.Root>
  );
}
