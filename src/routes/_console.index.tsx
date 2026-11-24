// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { noop, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Heading, Separator, Text } from "@vector-im/compound-web";
import { defineMessage, FormattedMessage } from "react-intl";

import { essVersionQuery, useEssVariant, useEssVersion } from "@/api/ess";
import {
  checkEssProUpdate,
  essProReleasesQuery,
  streamOf,
} from "@/api/ess-releases";
import { githubReleaseQuery } from "@/api/github";
import { usersCountQuery } from "@/api/mas";
import { roomsCountQuery, serverVersionQuery } from "@/api/synapse";
import * as Data from "@/components/data";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import AppFooter from "@/ui/footer";
import { compareMain, normalizeFull, type SemVer } from "verkit";

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

  loader: async ({ context: { queryClient, credentials, synapseRoot } }) => {
    // Kick the loading of these queries but don't await them
    queryClient.query(serverVersionQuery(synapseRoot)).catch(noop);
    queryClient.query(roomsCountQuery(synapseRoot)).catch(noop);
    queryClient.query(usersCountQuery(credentials.serverName)).catch(noop);

    // The latest-release tile only renders for ESS deployments, so a non-ESS
    // server skips the release lookup. Pro releases are versioned separately
    // from the community chart on GitHub.
    const { version, edition } = await queryClient.query({
      ...essVersionQuery(synapseRoot),
      staleTime: "static",
    });
    if (version && edition === "pro") {
      queryClient.query(essProReleasesQuery).catch(noop);
    } else if (version) {
      queryClient.query(latestEssReleaseQuery).catch(noop);
    }
  },
  component: RouteComponent,
});

interface ReleaseLinkProps {
  href: string;
  children: React.ReactNode;
}
const ReleaseLink: React.FC<ReleaseLinkProps> = ({
  href,
  children,
}: ReleaseLinkProps) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="text-text-link-external underline hover:no-underline"
  >
    {children}
  </a>
);

interface ReleaseStatusProps {
  href: string;
  name: string;
  status: React.ReactNode;
}
const ReleaseStatus: React.FC<ReleaseStatusProps> = ({
  href,
  name,
  status,
}: ReleaseStatusProps) => (
  <div>
    <ReleaseLink href={href}>{name}</ReleaseLink>
    <Text as="span" size="sm" className="text-text-secondary px-2">
      {status}
    </Text>
  </div>
);

const runningLatestMessage = defineMessage({
  id: "pages.dashboard.running_latest_ess",
  defaultMessage: "(You're running the latest version)",
  description:
    "On the dashboard, this shows that you're running the latest ESS version",
});

const newReleaseMessage = defineMessage({
  id: "pages.dashboard.new_ess_release",
  defaultMessage: "(New release)",
  description:
    "On the dashboard, this shows that there is a new ESS release available",
});

const runningLatestLtsMessage = defineMessage({
  id: "pages.dashboard.running_latest_ess_lts",
  defaultMessage: "(You're running the latest LTS release)",
  description:
    "On the dashboard, this shows that you're running the latest release of your ESS Pro LTS line",
});

const newLtsReleaseMessage = defineMessage({
  id: "pages.dashboard.new_ess_lts_release",
  defaultMessage: "(New LTS release)",
  description:
    "On the dashboard, this shows that there is a new release available on your ESS Pro LTS line",
});

interface LatestEssReleaseProps {
  essVersion: SemVer;
}

const LatestEssCommunityRelease: React.FC<LatestEssReleaseProps> = ({
  essVersion,
}: LatestEssReleaseProps) => {
  const { data } = useSuspenseQuery(latestEssReleaseQuery);
  const isRunningLatest = compareMain(essVersion, data.tag_name) >= 0;
  return (
    <Data.Value>
      <ReleaseStatus
        href={data.html_url}
        name={data.name}
        status={
          <FormattedMessage
            {...(isRunningLatest ? runningLatestMessage : newReleaseMessage)}
          />
        }
      />
    </Data.Value>
  );
};

const LatestEssProRelease: React.FC<LatestEssReleaseProps> = ({
  essVersion,
}: LatestEssReleaseProps) => {
  const { data } = useSuspenseQuery(essProReleasesQuery);
  const update = checkEssProUpdate(data, essVersion);
  if (!update) {
    throw new Error("The ESS Pro release feed has no release to compare to");
  }
  const { stream, latest, isRunningLatest, newerLts } = update;

  let status;
  if (stream === "lts") {
    status = isRunningLatest ? runningLatestLtsMessage : newLtsReleaseMessage;
  } else {
    status = isRunningLatest ? runningLatestMessage : newReleaseMessage;
  }

  return (
    <Data.Value>
      {latest && (
        <ReleaseStatus
          href={latest.link}
          name={latest.version}
          status={<FormattedMessage {...status} />}
        />
      )}
      {newerLts && (
        <Text as="div" size="sm" className="text-text-secondary">
          <FormattedMessage
            id="pages.dashboard.latest_ess_lts_stream"
            defaultMessage="{stream} is the latest LTS stream"
            description="On the dashboard, this points an ESS Pro LTS deployment at a more recent LTS release stream. {stream} is a link showing the stream's number, like 26.10"
            values={{
              stream: (
                <ReleaseLink href={newerLts.link}>
                  {streamOf(newerLts)}
                </ReleaseLink>
              ),
            }}
          />
        </Text>
      )}
    </Data.Value>
  );
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
  const { data } = useSuspenseQuery(usersCountQuery(serverName));
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
  const { credentials, synapseRoot } = Route.useRouteContext();
  const essVersion = useEssVersion(synapseRoot);
  const essVariant = useEssVariant(synapseRoot);

  return (
    <>
      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
          </Page.Header>

          <section className="flex flex-col gap-6">
            <div>
              {/* h2 to follow the page's h1 without a gap in heading levels;
                  size/weight match H3 to keep the established visual weight. */}
              <Heading as="h2" size="md" weight="semibold">
                {credentials.serverName}
              </Heading>
              <Separator kind="section" />
            </div>

            <Data.Grid>
              {!!essVersion && (
                <>
                  <Data.Item>
                    <Data.Title>
                      <FormattedMessage
                        id="pages.dashboard.current_ess_version"
                        defaultMessage="ESS version"
                        description="On the dashboard, this shows the current ESS version"
                      />
                    </Data.Title>
                    <Data.Value>{normalizeFull(essVersion)}</Data.Value>
                  </Data.Item>

                  <Data.Item>
                    <Data.Title>
                      <FormattedMessage
                        id="pages.dashboard.latest_ess_version"
                        defaultMessage="Latest ESS version"
                        description="On the dashboard, this shows the latest ESS release"
                      />
                    </Data.Title>
                    <Data.DynamicValue>
                      {essVariant === "pro" ? (
                        <LatestEssProRelease essVersion={essVersion} />
                      ) : (
                        <LatestEssCommunityRelease essVersion={essVersion} />
                      )}
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
                    description="On the dashboard, this shows the total number of rooms on the server"
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
        </Navigation.Main>

        <AppFooter />
      </Navigation.Content>

      <Outlet />
    </>
  );
}
