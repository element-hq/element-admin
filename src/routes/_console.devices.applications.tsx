// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
  keepPreviousData,
  useQuery,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { CheckboxMenuItem } from "@vector-im/compound-web";
import { useMemo } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import {
  oauth2ClientsCountQuery,
  oauth2ClientsInfiniteQuery,
  type OAuth2ClientListParameters,
} from "@/api/mas";
import type { SingleResourceForOAuth2Client } from "@/api/mas/api/types.gen";
import { ClientInfo } from "@/components/client-info";
import * as DataTable from "@/components/data-table";
import { TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import { useFilters } from "@/utils/filters";
import { useCurrentChildRoutePath } from "@/utils/routes";
import { Heading, PendingTab } from "./_console.devices";

const features = tableFeatures({});
const columnHelper = createColumnHelper<
  typeof features,
  SingleResourceForOAuth2Client
>();

const ClientSearchParameters = v.object({
  name: v.optional(v.string()),
  hasActiveSessions: v.optional(v.boolean()),
});

const titleMessage = defineMessage({
  id: "pages.devices.applications.title",
  defaultMessage: "Applications",
  description: "The title of the applications tab",
});

const descriptionMessage = defineMessage({
  id: "pages.devices.applications.description",
  defaultMessage: "Applications are OAuth 2.0 clients that users sign in to.",
  description: "The description of the applications list page",
});

export const Route = createFileRoute("/_console/devices/applications")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  validateSearch: ClientSearchParameters,

  loaderDeps: ({ search }) => {
    // Statically-registered applications (defined in the MAS configuration) are
    // hidden everywhere, so the list only ever shows dynamically-registered
    // ones.
    const parameters: OAuth2ClientListParameters = {
      kind: "dynamic",
      ...(search.name && { name: search.name }),
      ...(search.hasActiveSessions !== undefined && {
        hasActiveSessions: search.hasActiveSessions,
      }),
    };

    return { parameters };
  },
  loader: async ({
    context: { queryClient, credentials },
    deps: { parameters },
  }) => {
    queryClient.prefetchQuery(
      oauth2ClientsCountQuery(credentials.serverName, parameters),
    );

    await queryClient.ensureInfiniteQueryData(
      oauth2ClientsInfiniteQuery(credentials.serverName, parameters),
    );
  },

  pendingComponent: () => (
    <PendingTab title={titleMessage} description={descriptionMessage} />
  ),

  component: RouteComponent,
});

const filtersDefinition = [
  {
    key: "hasActiveSessions",
    value: true,
    message: defineMessage({
      id: "pages.devices.applications.filters.has_active_sessions",
      defaultMessage: "With active devices",
      description:
        "Filter label for applications which have at least one active device",
    }),
  },
  {
    key: "hasActiveSessions",
    value: false,
    message: defineMessage({
      id: "pages.devices.applications.filters.no_active_sessions",
      defaultMessage: "Without active devices",
      description: "Filter label for applications which have no active devices",
    }),
  },
] as const;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const { parameters } = Route.useLoaderDeps();
  const intl = useIntl();
  const from = useCurrentChildRoutePath(Route.id);
  const navigate = useNavigate({ from });

  const { data: totalCount } = useQuery({
    ...oauth2ClientsCountQuery(credentials.serverName, parameters),
    placeholderData: keepPreviousData,
  });

  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      oauth2ClientsInfiniteQuery(credentials.serverName, parameters),
    );

  const flatData = useMemo(
    () => data?.pages?.flatMap((page) => page.data) ?? [],
    [data],
  );

  const debouncedSearch = useDebouncedCallback(
    (term: string) => {
      navigate({
        replace: true,
        search: (previous) => {
          if (!term.trim()) {
            return { ...previous, name: undefined };
          }
          return { ...previous, name: term.trim() };
        },
      });
    },
    { key: "oauth2-clients-search", wait: 200 },
  );

  const filters = useFilters(search, filtersDefinition);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "name",
          header: intl.formatMessage({
            id: "pages.devices.applications.name_column",
            defaultMessage: "Name",
            description: "Column header for application name",
          }),
          meta: { width: DataTable.columnWidth.primary },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const client = row.original;
            return (
              <DataTable.RowLink
                to="/devices/applications/$clientId"
                params={{ clientId: client.id }}
                search={search}
                resetScroll={false}
                className="max-w-96"
              >
                <ClientInfo client={client.attributes} />
              </DataTable.RowLink>
            );
          },
        }),
      ]),
    [intl, search],
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
            title={titleMessage}
            description={descriptionMessage}
            search={
              <Page.Search
                placeholder={intl.formatMessage({
                  id: "pages.devices.applications.search_placeholder",
                  defaultMessage: "Search by name…",
                  description:
                    "The placeholder text for the application name search input",
                })}
                onInput={(event) => debouncedSearch(event.currentTarget.value)}
                defaultValue={search.name}
              />
            }
          />

          <DataTable.Root>
            <DataTable.Header>
              <DataTable.Title>
                {totalCount === undefined ? (
                  <Placeholder.LoadingText />
                ) : (
                  <FormattedMessage
                    id="pages.devices.applications.count"
                    defaultMessage="{COUNT, plural, =0 {No applications} one {# application} other {# applications}}"
                    description="On the applications list page, this heading shows the total number of applications"
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
                      navigate({
                        replace: true,
                        search: filter.toggledState,
                      });
                    }}
                    label={intl.formatMessage(filter.message)}
                    checked={filter.enabled}
                  />
                ))}
              </DataTable.FilterMenu>

              {filters.active.length > 0 && (
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

                  <TextLink
                    from={from}
                    replace={true}
                    search={filters.clearedState}
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
