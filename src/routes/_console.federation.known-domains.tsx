// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, Text } from "@vector-im/compound-web";
import { useCallback, useMemo, useRef } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import { wellKnownQuery } from "@/api/matrix";
import {
  type Destination,
  type DestinationListFilters,
  federationDestinationsInfiniteQuery,
} from "@/api/synapse";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as Table from "@/components/table";
import AppFooter from "@/ui/footer";
import { Heading } from "./_console.federation";
import { useCurrentChildRoutePath } from "@/utils/routes";
import { getDestinationStatus, StatusBadge } from "@/ui/destination-status";

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

  const columns = useMemo<ColumnDef<Destination>[]>(
    () => [
      {
        id: "serverName",
        // oxlint-disable-next-line react/no-unstable-nested-components
        header: () => (
          <FormattedMessage
            id="pages.federation.table.server_name"
            defaultMessage="Server name"
            description="In the list of destinations, the name of the server"
          />
        ),
        // oxlint-disable-next-line react/no-unstable-nested-components
        cell: ({ row }) => {
          const dest = row.original;
          return (
            <Link
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
            </Link>
          );
        },
      },
      {
        id: "status",
        // oxlint-disable-next-line react/no-unstable-nested-components
        header: () => (
          <FormattedMessage
            id="pages.federation.table.status"
            defaultMessage="Status"
            description="In the list of destinations, the status of the destination (e.g. connected, disconnected)"
          />
        ),
        // oxlint-disable-next-line react/no-unstable-nested-components
        cell: ({ row }) => {
          const dest = row.original;
          const status = getDestinationStatus(dest);
          return <StatusBadge status={status} />;
        },
      },
    ],
    [search],
  );

  // oxlint-disable-next-line react-compiler/incompatible-library -- We pass things as a ref to avoid this problem
  const table = useReactTable({
    data: flatData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const tableRef = useRef(table);

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

          <Table.Root>
            <Table.Header>
              <Table.Title>
                <FormattedMessage
                  id="pages.federation.domain_count"
                  defaultMessage="{COUNT, plural, zero {No domains} one {# domain} other {# domains}}"
                  description="On the federation page, this heading shows the total number of known domains"
                  values={{ COUNT: totalCount }}
                />
              </Table.Title>
            </Table.Header>

            <Table.VirtualizedList
              table={tableRef.current}
              canFetchNextPage={hasNextPage && !isFetching}
              fetchNextPage={fetchNextPage}
            />

            {isFetching && (
              <div className="flex justify-center py-4">
                <Text size="sm" className="text-text-secondary">
                  <FormattedMessage
                    id="pages.federation.loading"
                    defaultMessage="Loading more domains…"
                    description="The loading message for the federation known domains page"
                  />
                </Text>
              </div>
            )}
          </Table.Root>
        </Navigation.Main>

        <AppFooter />
      </Navigation.Content>
    </>
  );
}
