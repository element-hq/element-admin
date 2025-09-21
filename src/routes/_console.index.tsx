import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { H3, Separator, Text } from "@vector-im/compound-web";
import { lazy } from "react";
import { defineMessage, FormattedMessage } from "react-intl";
import incSemver from "semver/functions/inc";

import { useEssVersion } from "@/api/ess";
import { githubReleaseQuery } from "@/api/github";
import { registeredUsersCountQuery } from "@/api/mas";
import { wellKnownQuery } from "@/api/matrix";
import { roomsCountQuery, serverVersionQuery } from "@/api/synapse";
import * as Data from "@/components/data";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import AppFooter from "@/ui/footer";
import AppNavigation from "@/ui/navigation";

const ReleaseNotes = lazy(() => import("@/components/gfm"));

const titleMessage = defineMessage({
  id: "pages.dashboard.title",
  defaultMessage: "Dashboard",
  description: "The title of the dashboard page",
});

const latestEssReleaseQuery = githubReleaseQuery(
  "element-hq/ess-helm",
  "latest",
);

export const Route = createFileRoute("/_console/")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  loader: async ({ context: { queryClient, credentials } }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );

    const synapseRoot = wellKnown["m.homeserver"].base_url;

    // Kick the loading of the 4 queries but don't await them
    queryClient.prefetchQuery(serverVersionQuery(synapseRoot));
    queryClient.prefetchQuery(roomsCountQuery(synapseRoot));
    queryClient.prefetchQuery(
      registeredUsersCountQuery(credentials.serverName),
    );
    queryClient.prefetchQuery(latestEssReleaseQuery);
    // Also trigger the preloading of the Gfm component
    import("@/components/gfm");
  },
  component: RouteComponent,
});

interface LatestEssReleaseProps {
  isRunningLatest?: boolean;
}
const LatestEssRelease: React.FC<LatestEssReleaseProps> = ({
  isRunningLatest,
}: LatestEssReleaseProps) => {
  const { data } = useSuspenseQuery(latestEssReleaseQuery);
  return (
    <Data.Value>
      <a
        href={data.html_url}
        target="_blank"
        rel="noreferrer"
        className="text-text-link-external underline hover:no-underline"
      >
        {data.name}
      </a>
      <Text as="span" size="sm" className="text-text-secondary px-2">
        {isRunningLatest ? (
          <FormattedMessage
            id="pages.dashboard.running_latest_ess"
            defaultMessage="(You're running the latest version)"
            description="On the dashboard, this shows that you're running the latest ESS version"
          />
        ) : (
          <FormattedMessage
            id="pages.dashboard.new_ess_release"
            defaultMessage="(New release)"
            description="On the dashboard, this shows that there is a new ESS release available"
          />
        )}
      </Text>
    </Data.Value>
  );
};

interface EssReleaseNotesProps {
  version: string;
}
const EssReleaseNotes: React.FC<EssReleaseNotesProps> = ({
  version,
}: EssReleaseNotesProps) => {
  const { data } = useSuspenseQuery(
    githubReleaseQuery("element-hq/ess-helm", version),
  );
  return <ReleaseNotes markdown={data.body} repo="element-hq/ess-helm" />;
};

interface SynapseVersionProps {
  synapseRoot: string;
}
const SynapseVersion: React.FC<SynapseVersionProps> = ({
  synapseRoot,
}: SynapseVersionProps) => {
  const { data } = useSuspenseQuery(serverVersionQuery(synapseRoot));
  return <Data.Value>{data.server_version}</Data.Value>;
};

interface RegisteredUsersProps {
  serverName: string;
}
const RegisteredUsers: React.FC<RegisteredUsersProps> = ({
  serverName,
}: RegisteredUsersProps) => {
  const { data } = useSuspenseQuery(registeredUsersCountQuery(serverName));
  return <Data.NumericValue value={data} />;
};

interface TotalRoomsProps {
  synapseRoot: string;
}
const TotalRooms: React.FC<TotalRoomsProps> = ({
  synapseRoot,
}: TotalRoomsProps) => {
  const { data } = useSuspenseQuery(roomsCountQuery(synapseRoot));
  return <Data.NumericValue value={data} />;
};

function RouteComponent() {
  const { credentials } = Route.useRouteContext();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );

  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const essVersion = useEssVersion(synapseRoot);
  const { data: latestEssRelease } = useQuery(latestEssReleaseQuery);
  let isUsingLatest = false;
  if (latestEssRelease?.tag_name && essVersion) {
    isUsingLatest = essVersion.compareMain(latestEssRelease.tag_name) >= 0;
  }
  let releaseNotesToLoad = "latest";
  if (!isUsingLatest && essVersion) {
    // Grab the main version from the preversion
    const cleanedUpVersion =
      (essVersion.prerelease.length > 0 && incSemver(essVersion, "release")) ||
      essVersion.toString();
    releaseNotesToLoad = `tags/${cleanedUpVersion}`;
  }

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

            <Data.Grid>
              {!!essVersion && (
                <>
                  <Data.Item>
                    <Data.Title>
                      <FormattedMessage
                        id="pages.dashboard.current_ess_version"
                        defaultMessage="Your current ESS version"
                        description="On the dashboard, this shows the current ESS version"
                      />
                    </Data.Title>
                    <Data.Value>{essVersion.toString()}</Data.Value>
                  </Data.Item>

                  <Data.Item>
                    <Data.Title>
                      <FormattedMessage
                        id="pages.dashboard.latest_ess_release"
                        defaultMessage="Latest ESS release"
                        description="On the dashboard, this shows the latest ESS release"
                      />
                    </Data.Title>
                    <Data.DynamicValue>
                      <LatestEssRelease isRunningLatest={isUsingLatest} />
                    </Data.DynamicValue>
                  </Data.Item>
                </>
              )}

              <Data.Item>
                <Data.Title>
                  <FormattedMessage
                    id="pages.dashboard.synapse_version"
                    defaultMessage="Synapse version"
                    description="On the dashboard, this shows the Synapse version"
                  />
                </Data.Title>
                <Data.DynamicValue>
                  <SynapseVersion synapseRoot={synapseRoot} />
                </Data.DynamicValue>
              </Data.Item>

              <Data.Item>
                <Data.Title>
                  <FormattedMessage
                    id="pages.dashboard.rooms_count"
                    defaultMessage="Rooms total"
                    description="On the dashboard, this shows the Synapse uptime"
                  />
                </Data.Title>
                <Data.DynamicValue>
                  <TotalRooms synapseRoot={synapseRoot} />
                </Data.DynamicValue>
              </Data.Item>

              <Data.Item>
                <Data.Title>
                  <FormattedMessage
                    id="pages.dashboard.registered_users_count"
                    defaultMessage="Users registered"
                    description="On the dashboard, this shows the number of users registered in MAS"
                  />
                </Data.Title>
                <Data.DynamicValue>
                  <RegisteredUsers serverName={credentials.serverName} />
                </Data.DynamicValue>
              </Data.Item>
            </Data.Grid>
          </section>

          {!!essVersion && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.dashboard.latest_ess_release_notes"
                  defaultMessage="What's new in ESS"
                  description="On the dashboard, this shows the latest ESS release notes"
                />
              </Data.Title>
              <Data.DynamicValue>
                <section>
                  <EssReleaseNotes version={releaseNotesToLoad} />
                </section>
              </Data.DynamicValue>
            </Data.Item>
          )}
        </Navigation.Main>

        <AppFooter />
      </Navigation.Content>

      <Outlet />
    </Navigation.Root>
  );
}
