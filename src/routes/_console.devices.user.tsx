// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  keepPreviousData,
  useQuery,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { CheckboxMenuItem, Text } from "@vector-im/compound-web";
import { Suspense, useMemo } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import {
  oauth2ClientQuery,
  oauth2SessionsCountQuery,
  oauth2SessionsInfiniteQuery,
  type OAuth2SessionListParameters,
  userQuery,
} from "@/api/mas";
import type { SingleResourceForOAuth2Session } from "@/api/mas/api/types.gen";
import * as DataTable from "@/components/data-table";
import { TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as Placeholder from "@/components/placeholder";
import * as messages from "@/messages";
import { DeviceInfo } from "@/ui/device-info";
import {
  DeviceStatusBadge,
  useActivityCutoffs,
} from "@/ui/device-status-badge";
import AppFooter from "@/ui/footer";
import { ClientCell, UserCell } from "@/ui/user-cell";
import {
  type ActivityBucket,
  activityFilterParameters,
} from "@/utils/device-activity";
import { useFilters } from "@/utils/filters";
import { useCurrentChildRoutePath } from "@/utils/routes";
import { deviceIdFromScope } from "@/utils/scope";
import { Heading, PendingTab } from "./_console.devices";

const features = tableFeatures({});
const columnHelper = createColumnHelper<
  typeof features,
  SingleResourceForOAuth2Session
>();

// The buckets the list can be filtered by, checked against the shared union so
// this picklist and `activityFilterParameters` can't drift apart.
const activityBuckets = [
  "recently-used",
  "active",
  "inactive",
  "signed-out",
] as const satisfies readonly ActivityBucket[];

const SessionSearchParameters = v.object({
  activity: v.optional(v.picklist(activityBuckets)),
  client: v.optional(v.array(v.string())),
  user: v.optional(v.string()),
  dir: v.optional(v.picklist(["forward", "backward"])),
});

type SessionSearch = v.InferOutput<typeof SessionSearchParameters>;

const titleMessage = defineMessage({
  id: "pages.devices.user.title",
  defaultMessage: "User devices",
  description: "The title of the user devices tab",
});

const descriptionMessage = defineMessage({
  id: "pages.devices.user.description",
  defaultMessage:
    "A device represents a single sign-in a user has on an application. Signing out a device revokes its access immediately.",
  description: "The description of the user devices tab",
});

export const Route = createFileRoute("/_console/devices/user")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  validateSearch: SessionSearchParameters,

  loaderDeps: ({ search }) => {
    // Devices from statically-registered applications are hidden everywhere.
    const parameters: OAuth2SessionListParameters = {
      clientKind: "dynamic",
      ...activityFilterParameters(search.activity),
      ...(search.client &&
        search.client.length > 0 && { client: search.client }),
      ...(search.user && { user: search.user }),
    };
    return { parameters, direction: search.dir };
  },
  loader: async ({
    context: { queryClient, credentials },
    deps: { parameters, direction },
  }) => {
    queryClient.prefetchQuery(
      oauth2SessionsCountQuery(credentials.serverName, parameters),
    );

    await queryClient.ensureInfiniteQueryData(
      oauth2SessionsInfiniteQuery(
        credentials.serverName,
        parameters,
        direction,
      ),
    );
  },

  pendingComponent: () => (
    <PendingTab title={titleMessage} description={descriptionMessage} />
  ),

  component: RouteComponent,
});

const filtersDefinition = [
  {
    key: "dir",
    value: "backward",
    message: defineMessage({
      id: "pages.devices.user.filters.newest_first",
      defaultMessage: "Newest first",
      description: "Filter label for sorting devices newest first",
    }),
  },
  {
    key: "activity",
    value: "recently-used",
    message: defineMessage({
      id: "pages.devices.user.filters.activity_recently_used",
      defaultMessage: "Recently used",
      description: "Filter label for devices used in the last couple of weeks",
    }),
  },
  {
    key: "activity",
    value: "active",
    message: defineMessage({
      id: "pages.devices.user.filters.activity_active",
      defaultMessage: "Active",
      description:
        "Filter label for active devices used in the last few months",
    }),
  },
  {
    key: "activity",
    value: "inactive",
    message: defineMessage({
      id: "pages.devices.user.filters.activity_inactive",
      defaultMessage: "Inactive",
      description: "Filter label for devices not used in 90+ days",
    }),
  },
  {
    key: "activity",
    value: "signed-out",
    message: defineMessage({
      id: "pages.devices.user.filters.activity_signed_out",
      defaultMessage: "Signed out",
      description: "Filter label for signed-out (finished) devices",
    }),
  },
] as const;

const ClientFilterLabel = ({
  serverName,
  clientId,
}: {
  serverName: string;
  clientId: string;
}) => {
  const {
    data: { data: client },
  } = useSuspenseQuery(oauth2ClientQuery(serverName, clientId));
  return (
    <FormattedMessage
      id="pages.devices.user.filters.client_chip"
      defaultMessage="Application: {name}"
      description="Active filter chip showing the currently filtered application"
      values={{
        name: client.attributes.client_name ?? client.attributes.client_id,
      }}
    />
  );
};

const UserFilterLabel = ({
  serverName,
  userId,
}: {
  serverName: string;
  userId: string;
}) => {
  const {
    data: { data: user },
  } = useSuspenseQuery(userQuery(serverName, userId));
  return (
    <FormattedMessage
      id="pages.devices.user.filters.user_chip"
      defaultMessage="User: @{localpart}:{server}"
      description="Active filter chip showing the currently filtered user"
      values={{
        localpart: user.attributes.username,
        server: serverName,
      }}
    />
  );
};

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const { parameters, direction } = Route.useLoaderDeps();
  const intl = useIntl();
  const from = useCurrentChildRoutePath(Route.id);
  const navigate = useNavigate({ from });
  const cutoffs = useActivityCutoffs();

  const { data: totalCount } = useQuery({
    ...oauth2SessionsCountQuery(credentials.serverName, parameters),
    placeholderData: keepPreviousData,
  });

  const isBackward = search.dir === "backward";
  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      oauth2SessionsInfiniteQuery(
        credentials.serverName,
        parameters,
        direction,
      ),
    );

  const flatData = useMemo(
    () =>
      data?.pages?.flatMap((page) =>
        isBackward ? page.data.toReversed() : page.data,
      ) ?? [],
    [data, isBackward],
  );

  const filters = useFilters(search, filtersDefinition);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "device",
          header: intl.formatMessage({
            id: "pages.devices.user.device_column",
            defaultMessage: "Device",
            description: "Column header for the device name and ID",
          }),
          meta: { width: DataTable.columnWidth.primary },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const session = row.original;
            const deviceId = deviceIdFromScope(session.attributes.scope);
            return (
              <DataTable.RowLink
                to="/devices/user/$sessionId"
                params={{ sessionId: session.id }}
                search={search}
                resetScroll={false}
              >
                <DeviceInfo
                  humanName={session.attributes.human_name}
                  userAgent={session.attributes.user_agent}
                  deviceId={deviceId}
                  fallbackName={deviceId}
                />
              </DataTable.RowLink>
            );
          },
        }),
        columnHelper.display({
          id: "client",
          header: intl.formatMessage({
            id: "pages.devices.user.client_column",
            defaultMessage: "Application",
            description: "Column header for the application of a device",
          }),
          meta: { width: { min: 180, fr: 1 } },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => (
            <ClientCell
              serverName={credentials.serverName}
              clientId={row.original.attributes.client_id}
            />
          ),
        }),
        columnHelper.display({
          id: "user",
          header: intl.formatMessage({
            id: "pages.devices.user.user_column",
            defaultMessage: "User",
            description: "Column header for the user of a device",
          }),
          meta: { width: { min: 200, fr: 1 } },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const session = row.original;
            if (!session.attributes.user_id) {
              return (
                <Text size="sm" className="text-text-secondary">
                  <FormattedMessage
                    id="pages.devices.user.user_none"
                    defaultMessage="No user"
                    description="Shown when a device has no associated user"
                  />
                </Text>
              );
            }
            return (
              <UserCell
                serverName={credentials.serverName}
                userId={session.attributes.user_id}
              />
            );
          },
        }),
        columnHelper.display({
          id: "status",
          header: intl.formatMessage({
            id: "pages.devices.user.status_column",
            defaultMessage: "Status",
            description: "Column header for device status",
          }),
          meta: { width: DataTable.columnWidth.status },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => (
            <DeviceStatusBadge
              finishedAt={row.original.attributes.finished_at}
              lastActiveAt={row.original.attributes.last_active_at}
              cutoffs={cutoffs}
            />
          ),
        }),
      ]),
    [credentials.serverName, cutoffs, intl, search],
  );

  const table = useTable({
    features,
    data: flatData,
    columns,
  });

  const hasContextFilters =
    (search.client && search.client.length > 0) || !!search.user;
  const hasAnyActiveFilters = filters.active.length > 0 || hasContextFilters;

  const removeClient = (clientId: string): SessionSearch => {
    const remaining = (search.client ?? []).filter((id) => id !== clientId);
    return {
      ...search,
      client: remaining.length > 0 ? remaining : undefined,
    };
  };

  const removeUser = (): SessionSearch => ({
    ...search,
    user: undefined,
  });

  return (
    <>
      <Outlet />

      <Navigation.Content>
        <Navigation.Main>
          <Heading title={titleMessage} description={descriptionMessage} />

          <DataTable.Root>
            <DataTable.Header>
              <DataTable.Title>
                {totalCount === undefined ? (
                  <Placeholder.Text />
                ) : (
                  <FormattedMessage
                    id="pages.devices.user.count"
                    defaultMessage="{COUNT, plural, =0 {No devices} one {# device} other {# devices}}"
                    description="On the devices list page, this heading shows the total number of devices"
                    values={{ COUNT: totalCount }}
                  />
                )}
              </DataTable.Title>

              <DataTable.FilterMenu>
                {filters.all.map((filter) => (
                  <CheckboxMenuItem
                    key={filter.key}
                    onSelect={(event) => {
                      event.preventDefault();
                      navigate({ replace: true, search: filter.toggledState });
                    }}
                    label={intl.formatMessage(filter.message)}
                    checked={filter.enabled}
                  />
                ))}
              </DataTable.FilterMenu>

              {hasAnyActiveFilters && (
                <DataTable.ActiveFilterList>
                  {filters.active.map((filter) => (
                    <DataTable.ActiveFilter key={filter.key}>
                      <FormattedMessage {...filter.message} />
                      <DataTable.RemoveFilterLink
                        from={from}
                        replace={true}
                        search={filter.toggledState}
                      />
                    </DataTable.ActiveFilter>
                  ))}

                  {search.client?.map((clientId) => (
                    <DataTable.ActiveFilter key={`client-${clientId}`}>
                      <Suspense fallback={<Placeholder.Text />}>
                        <ClientFilterLabel
                          serverName={credentials.serverName}
                          clientId={clientId}
                        />
                      </Suspense>
                      <DataTable.RemoveFilterLink
                        from={from}
                        replace={true}
                        search={removeClient(clientId)}
                      />
                    </DataTable.ActiveFilter>
                  ))}

                  {search.user && (
                    <DataTable.ActiveFilter>
                      <Suspense fallback={<Placeholder.Text />}>
                        <UserFilterLabel
                          serverName={credentials.serverName}
                          userId={search.user}
                        />
                      </Suspense>
                      <DataTable.RemoveFilterLink
                        from={from}
                        replace={true}
                        search={removeUser()}
                      />
                    </DataTable.ActiveFilter>
                  )}

                  <TextLink
                    from={from}
                    replace={true}
                    search={{
                      ...filters.clearedState,
                      client: undefined,
                      user: undefined,
                    }}
                    size="sm"
                  >
                    <FormattedMessage {...messages.actionClear} />
                  </TextLink>
                </DataTable.ActiveFilterList>
              )}
            </DataTable.Header>

            <DataTable.List
              table={table}
              totalCount={totalCount}
              hasNextPage={hasNextPage}
              isFetching={isFetching}
              fetchNextPage={fetchNextPage}
            />
          </DataTable.Root>
        </Navigation.Main>

        <AppFooter />
      </Navigation.Content>
    </>
  );
}
