// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Avatar, Text } from "@vector-im/compound-web";
import { useCallback, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import { wellKnownQuery } from "@/api/matrix";
import {
  type Destination,
  type DestinationListFilters,
  federationDestinationsInfiniteQuery,
} from "@/api/synapse";
import * as DataTable from "@/components/data-table";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import AppFooter from "@/ui/footer";
import { Heading } from "./_console.federation";
import { useCurrentChildRoutePath } from "@/utils/routes";
import { getDestinationStatus, StatusBadge } from "@/ui/destination-status";

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, Destination>();

const FederationSearchParameters = v.object({
  search_term: v.optional(v.string()),
});

export const Route = createFileRoute("/_console/federation/known-domains")({
  validateSearch: FederationSearchParameters,

  loaderDeps: ({ search }) => ({
    parameters: {
      ...(search.search_term && { destination: search.search_term }),
    } satisfies DestinationListFilters,
  }),
  loader: async ({
    context: { queryClient, credentials },
    deps: { parameters },
  }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    await queryClient.ensureInfiniteQueryData(
      federationDestinationsInfiniteQuery(synapseRoot, parameters),
    );
  },

  pendingComponent: () => (
    <>
      <Outlet />

      <Navigation.Content>
        <Navigation.Main>
          <Heading />

          <Placeholder.LoadingTable />
        </Navigation.Main>

        <AppFooter />
      </Navigation.Content>
    </>
  ),

  component: RouteComponent,
});

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const intl = useIntl();
  const search = Route.useSearch();
  const { parameters } = Route.useLoaderDeps();
  const from = useCurrentChildRoutePath(Route.id);
  const navigate = useNavigate({ from });

  const debouncedSearch = useDebouncedCallback(
    (term: string) => {
      navigate({
        replace: true,
        search: (previous) => {
          if (!term.trim()) {
            return { ...previous, search_term: undefined };
          }

          return { ...previous, search_term: term.trim() };
        },
      });
    },
    {
      key: "federation-destination-search",
      wait: 400,
    },
  );

  const onSearchInput = useCallback(
    (event: React.InputEvent<HTMLInputElement>) => {
      debouncedSearch(event.currentTarget.value);
    },
    [debouncedSearch],
  );

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      federationDestinationsInfiniteQuery(synapseRoot, parameters),
    );

  const flatData = useMemo(
    () => data?.pages?.flatMap((page) => page.destinations) ?? [],
    [data],
  );

  const totalCount = data.pages[0]?.total ?? 0;

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "serverName",
          meta: { width: DataTable.columnWidth.primary },
          header: intl.formatMessage({
            id: "pages.federation.table.server_name",
            defaultMessage: "Server name",
            description: "In the list of destinations, the name of the server",
          }),
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const dest = row.original;
            return (
              <DataTable.RowLink
                to="/federation/known-domains/$destination"
                params={{ destination: dest.destination }}
                search={search}
                resetScroll={false}
                className="flex items-center gap-3"
              >
                <Avatar
                  id={dest.destination}
                  name={dest.destination}
                  type="square"
                  size="32px"
                />
                <Text size="md" weight="semibold" className="text-text-primary">
                  {dest.destination}
                </Text>
              </DataTable.RowLink>
            );
          },
        }),
        columnHelper.display({
          id: "status",
          meta: { width: DataTable.columnWidth.status },
          header: intl.formatMessage({
            id: "pages.federation.table.status",
            defaultMessage: "Status",
            description:
              "In the list of destinations, the status of the destination (e.g. connected, disconnected)",
          }),
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const dest = row.original;
            const status = getDestinationStatus(dest);
            return <StatusBadge status={status} />;
          },
        }),
      ]),
    [search, intl],
  );

  const table = useTable({
    features,
    data: flatData,
    columns,
  });

  return (
    <>
      <Outlet />

      <Navigation.Content>
        <Navigation.Main>
          <Heading
            search={
              <Page.Search
                placeholder={intl.formatMessage({
                  id: "pages.federation.search_placeholder",
                  defaultMessage: "Search domains…",
                  description:
                    "The placeholder text for the search input on the federation known domains page",
                })}
                defaultValue={search.search_term}
                onInput={onSearchInput}
              />
            }
          />

          <DataTable.Root>
            <DataTable.Header>
              <DataTable.Title>
                <FormattedMessage
                  id="pages.federation.domain_count"
                  defaultMessage="{COUNT, plural, =0 {No domains} one {# domain} other {# domains}}"
                  description="On the federation page, this heading shows the total number of known domains"
                  values={{ COUNT: totalCount }}
                />
              </DataTable.Title>
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
