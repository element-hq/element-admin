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
import { CheckboxMenuItem } from "@vector-im/compound-web";
import { Suspense, useMemo } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import {
  compatSessionsCountQuery,
  compatSessionsInfiniteQuery,
  type CompatSessionListParameters,
  userQuery,
} from "@/api/mas";
import type { SingleResourceForCompatSession } from "@/api/mas/api/types.gen";
import {
  DeviceStatusBadge,
  useActivityCutoffs,
} from "@/ui/device-status-badge";
import { DeviceInfo } from "@/ui/device-info";
import { TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as Placeholder from "@/components/placeholder";
import { UserCell } from "@/ui/user-cell";
import * as DataTable from "@/components/data-table";
import * as messages from "@/messages";
import {
  type ActivityBucket,
  activityFilterParameters,
} from "@/utils/device-activity";
import AppFooter from "@/ui/footer";
import { useFilters } from "@/utils/filters";
import { useCurrentChildRoutePath } from "@/utils/routes";
import { Heading, PendingTab } from "./_console.devices";

const features = tableFeatures({});
const columnHelper = createColumnHelper<
  typeof features,
  SingleResourceForCompatSession
>();

// Typed against the shared union so the search param and the bucket → API
// filter mapping in `activityFilterParameters` can't drift apart.
const activityBuckets: readonly ActivityBucket[] = [
  "recently-used",
  "active",
  "inactive",
  "signed-out",
];

const SessionSearchParameters = v.object({
  activity: v.optional(v.picklist(activityBuckets)),
  user: v.optional(v.string()),
  dir: v.optional(v.picklist(["forward", "backward"])),
});

type SessionSearch = v.InferOutput<typeof SessionSearchParameters>;

const titleMessage = defineMessage({
  id: "pages.devices.legacy.title",
  defaultMessage: "Legacy devices",
  description: "The title of the legacy devices tab",
});

const descriptionMessage = defineMessage({
  id: "pages.devices.legacy.description",
  defaultMessage:
    "Legacy devices are sign-ins from clients that have not yet migrated to OAuth 2.0.",
  description: "The description of the legacy devices list page",
});

export const Route = createFileRoute("/_console/devices/legacy")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  validateSearch: SessionSearchParameters,

  loaderDeps: ({ search }) => {
    const parameters: CompatSessionListParameters = {
      ...activityFilterParameters(search.activity),
      ...(search.user && { user: search.user }),
    };
    return { parameters, direction: search.dir };
  },
  loader: async ({
    context: { queryClient, credentials },
    deps: { parameters, direction },
  }) => {
    queryClient.prefetchQuery(
      compatSessionsCountQuery(credentials.serverName, parameters),
    );

    await queryClient.ensureInfiniteQueryData(
      compatSessionsInfiniteQuery(
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
      id: "pages.devices.legacy.filters.newest_first",
      defaultMessage: "Newest first",
      description: "Filter label for sorting legacy devices newest first",
    }),
  },
  {
    key: "activity",
    value: "recently-used",
    message: defineMessage({
      id: "pages.devices.legacy.filters.activity_recently_used",
      defaultMessage: "Recently used",
      description:
        "Filter label for legacy devices used in the last couple of weeks",
    }),
  },
  {
    key: "activity",
    value: "active",
    message: defineMessage({
      id: "pages.devices.legacy.filters.activity_active",
      defaultMessage: "Active",
      description:
        "Filter label for active legacy devices used in the last few months",
    }),
  },
  {
    key: "activity",
    value: "inactive",
    message: defineMessage({
      id: "pages.devices.legacy.filters.activity_inactive",
      defaultMessage: "Inactive",
      description: "Filter label for legacy devices not used in 90+ days",
    }),
  },
  {
    key: "activity",
    value: "signed-out",
    message: defineMessage({
      id: "pages.devices.legacy.filters.activity_signed_out",
      defaultMessage: "Signed out",
      description: "Filter label for signed-out (finished) legacy devices",
    }),
  },
] as const;

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
      id="pages.devices.legacy.filters.user_chip"
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
    ...compatSessionsCountQuery(credentials.serverName, parameters),
    placeholderData: keepPreviousData,
  });

  const isBackward = search.dir === "backward";
  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      compatSessionsInfiniteQuery(
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
            id: "pages.devices.legacy.device_column",
            defaultMessage: "Device",
            description: "Column header for the legacy device name and ID",
          }),
          meta: { width: DataTable.columnWidth.primary },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const session = row.original;
            return (
              <DataTable.RowLink
                to="/devices/legacy/$sessionId"
                params={{ sessionId: session.id }}
                search={search}
                resetScroll={false}
              >
                <DeviceInfo
                  humanName={session.attributes.human_name}
                  userAgent={session.attributes.user_agent}
                  deviceId={session.attributes.device_id}
                  fallbackName={session.attributes.device_id}
                />
              </DataTable.RowLink>
            );
          },
        }),
        columnHelper.display({
          id: "user",
          header: intl.formatMessage({
            id: "pages.devices.legacy.user_column",
            defaultMessage: "User",
            description: "Column header for the user of a legacy device",
          }),
          meta: { width: { min: 200, fr: 1 } },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => (
            <UserCell
              serverName={credentials.serverName}
              userId={row.original.attributes.user_id}
            />
          ),
        }),
        columnHelper.display({
          id: "status",
          header: intl.formatMessage({
            id: "pages.devices.legacy.status_column",
            defaultMessage: "Status",
            description: "Column header for legacy device status",
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

  const hasContextFilters = !!search.user;
  const hasAnyActiveFilters = filters.active.length > 0 || hasContextFilters;

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
                  <Placeholder.LoadingText />
                ) : (
                  <FormattedMessage
                    id="pages.devices.legacy.count"
                    defaultMessage="{COUNT, plural, =0 {No legacy devices} one {# legacy device} other {# legacy devices}}"
                    description="On the legacy devices list page, this heading shows the total number of legacy devices"
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
                    search={{ ...filters.clearedState, user: undefined }}
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
