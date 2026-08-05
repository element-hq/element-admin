// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CloseIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Alert, Avatar, Text, Tooltip } from "@vector-im/compound-web";
import { FormattedMessage, useIntl } from "react-intl";

import {
  oauth2ClientQuery,
  oauth2SessionsCountQuery,
  type OAuth2SessionListParameters,
} from "@/api/mas";
import * as Data from "@/components/data";
import { DetailHeader } from "@/components/detail-header";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as messages from "@/messages";
import { defaultUserDevicesSearch } from "@/ui/device-tabs";
import { daysAgoIso } from "@/utils/device-activity";
import { ensureParametersAreUlids } from "@/utils/parameters";

// The window the "recently" statistics below look back over.
const STATISTICS_WINDOW_DAYS = 7;

// The filters behind the three "device statistics" counts. Built in one place so
// the loader prefetches exactly the query keys the component then reads.
const statisticsParameters = (clientId: string, since: string) =>
  ({
    totalActive: { client: [clientId], status: "active" },
    createdRecently: { client: [clientId], createdAfter: since },
    activeRecently: {
      client: [clientId],
      status: "active",
      lastActiveAfter: since,
    },
  }) satisfies Record<string, OAuth2SessionListParameters>;

export const Route = createFileRoute(
  "/_console/devices/applications/$clientId",
)({
  // The counts are point-in-time rather than live. `daysAgoIso` floors the
  // cutoff to the start of the UTC day, so it stays stable within a day instead
  // of missing the cache (and leaking an entry) on every mount.
  loaderDeps: () => ({
    since: daysAgoIso(Date.now(), STATISTICS_WINDOW_DAYS),
  }),
  loader: async ({
    context: { queryClient, credentials },
    params,
    deps: { since },
  }) => {
    ensureParametersAreUlids(params);

    for (const parameters of Object.values(
      statisticsParameters(params.clientId, since),
    )) {
      queryClient.prefetchQuery(
        oauth2SessionsCountQuery(credentials.serverName, parameters),
      );
    }

    await queryClient.ensureQueryData(
      oauth2ClientQuery(credentials.serverName, params.clientId),
    );
  },
  component: ClientDetailComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  const { clientId } = Route.useParams();
  const {
    credentials: { serverName },
  } = Route.useRouteContext();
  const intl = useIntl();
  return (
    <Navigation.Details className="gap-4">
      <CloseSidebar />

      <Alert
        type="critical"
        title={intl.formatMessage({
          id: "pages.devices.applications.not_found.title",
          defaultMessage: "Application not found",
          description:
            "The title of the alert when an application could not be found",
        })}
      >
        <FormattedMessage
          id="pages.devices.applications.not_found.description"
          defaultMessage="The requested application ({clientId}) could not be found on {serverName}."
          description="The description of the alert when an application could not be found"
          values={{ clientId, serverName }}
        />
      </Alert>

      <ButtonLink
        kind="secondary"
        size="md"
        to="/devices/applications"
        Icon={ArrowLeftIcon}
      >
        <FormattedMessage {...messages.actionGoBack} />
      </ButtonLink>
    </Navigation.Details>
  );
}

const CloseSidebar: React.FC = () => {
  const intl = useIntl();
  const search = Route.useSearch();
  return (
    <div className="flex items-center justify-end">
      <Tooltip label={intl.formatMessage(messages.actionClose)}>
        <ButtonLink
          iconOnly
          to="/devices/applications"
          search={search}
          kind="tertiary"
          size="md"
          Icon={CloseIcon}
        />
      </Tooltip>
    </div>
  );
};

interface SessionStatValueProps {
  serverName: string;
  parameters: OAuth2SessionListParameters;
}

function SessionStatValue({ serverName, parameters }: SessionStatValueProps) {
  const { data: count } = useSuspenseQuery(
    oauth2SessionsCountQuery(serverName, parameters),
  );
  return <Data.NumericValue value={count} />;
}

function ClientDetailComponent() {
  const { credentials } = Route.useRouteContext();
  const { clientId } = Route.useParams();

  const {
    data: { data: client },
  } = useSuspenseQuery(oauth2ClientQuery(credentials.serverName, clientId));

  const { since } = Route.useLoaderDeps();
  const statistics = statisticsParameters(clientId, since);

  return (
    <Navigation.Details>
      <CloseSidebar />

      <div className="flex flex-col gap-6">
        <DetailHeader
          icon={
            <Avatar
              id={client.attributes.client_id}
              name={
                client.attributes.client_name ?? client.attributes.client_id
              }
              src={client.attributes.logo_uri ?? undefined}
              size="64px"
              type="square"
            />
          }
          title={client.attributes.client_name ?? client.attributes.client_id}
          subtitle={client.attributes.client_uri}
        />

        <Data.Grid>
          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.devices.applications.client_id_label"
                defaultMessage="Client ID"
                description="Label for the OAuth 2.0 client identifier (technical term, shown on application details)"
              />
            </Data.Title>
            <Data.Value>{client.attributes.client_id}</Data.Value>
          </Data.Item>

          {client.attributes.client_uri && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.applications.uri_label"
                  defaultMessage="Homepage"
                  description="Label for the application's homepage URI"
                />
              </Data.Title>
              <Data.Value>
                <a
                  href={client.attributes.client_uri}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-text-link-external break-all underline"
                >
                  {client.attributes.client_uri}
                </a>
              </Data.Value>
            </Data.Item>
          )}

          {client.attributes.redirect_uris.length > 0 && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.applications.redirect_uris_label"
                  defaultMessage="Redirect URIs"
                  description="Label for the application's redirect URIs"
                />
              </Data.Title>
              {client.attributes.redirect_uris.map((uri) => (
                <Data.Value key={uri} className="break-all">
                  {uri}
                </Data.Value>
              ))}
            </Data.Item>
          )}

          {client.attributes.grant_types.length > 0 && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.applications.grant_types_label"
                  defaultMessage="Grant types"
                  description="Label for the grant types an application supports"
                />
              </Data.Title>
              {client.attributes.grant_types.map((grant) => (
                <Data.Value key={grant} className="break-all font-mono">
                  {grant}
                </Data.Value>
              ))}
            </Data.Item>
          )}
        </Data.Grid>

        <div className="flex flex-col gap-2">
          <Text
            as="h4"
            size="md"
            weight="semibold"
            className="text-text-primary"
          >
            <FormattedMessage
              id="pages.devices.applications.statistics.heading"
              defaultMessage="Device statistics"
              description="Heading for the device statistics section on the application details page"
            />
          </Text>
          <Data.Grid>
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.applications.statistics.total_active"
                  defaultMessage="Active devices"
                  description="Stat label: total active devices for this application"
                />
              </Data.Title>
              <Data.DynamicValue>
                <SessionStatValue
                  serverName={credentials.serverName}
                  parameters={statistics.totalActive}
                />
              </Data.DynamicValue>
            </Data.Item>

            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.applications.statistics.created_recently"
                  defaultMessage="Devices added in the past 7 days"
                  description="Stat label: devices created in the past 7 days for this application"
                />
              </Data.Title>
              <Data.DynamicValue>
                <SessionStatValue
                  serverName={credentials.serverName}
                  parameters={statistics.createdRecently}
                />
              </Data.DynamicValue>
            </Data.Item>

            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.applications.statistics.active_recently"
                  defaultMessage="Active in the past 7 days"
                  description="Stat label: devices currently active and last seen in the past 7 days for this application"
                />
              </Data.Title>
              <Data.DynamicValue>
                <SessionStatValue
                  serverName={credentials.serverName}
                  parameters={statistics.activeRecently}
                />
              </Data.DynamicValue>
            </Data.Item>
          </Data.Grid>

          <ButtonLink
            kind="secondary"
            size="md"
            to="/devices/user"
            search={{ ...defaultUserDevicesSearch, client: [clientId] }}
          >
            <FormattedMessage
              id="pages.devices.applications.view_sessions"
              defaultMessage="View all devices"
              description="Button on the application details sidebar that navigates to the devices list filtered to this application"
            />
          </ButtonLink>
        </div>
      </div>
    </Navigation.Details>
  );
}
