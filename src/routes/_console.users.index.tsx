/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  DownloadIcon,
  UserAddIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Badge, Button, Text } from "@vector-im/compound-web";
import { Fragment } from "react";
import { FormattedMessage } from "react-intl";
import * as v from "valibot";

import { type UserListFilters, usersInfiniteQuery } from "@/api/mas";
import { ChatFilterLink } from "@/components/link";
import * as Page from "@/components/page";
import * as Table from "@/components/table";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

const UserSearchParameters = v.object({
  admin: v.optional(v.boolean()),
  status: v.optional(v.picklist(["active", "locked", "deactivated"])),
});

export const Route = createFileRoute("/_console/users/")({
  validateSearch: UserSearchParameters,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials, intl },
    deps: { search },
  }) => {
    const parameters: UserListFilters = {
      ...(search.admin !== undefined && { admin: search.admin }),
      ...(search.status && { status: search.status }),
    };

    await queryClient.ensureInfiniteQueryData(
      usersInfiniteQuery(credentials.serverName, parameters),
    );

    return {
      title: intl.formatMessage({
        id: "pages.users.title",
        defaultMessage: "Users",
        description: "The title of the users list page",
      }),
    };
  },

  head: ({ loaderData }) => ({
    meta: [loaderData ? { title: loaderData.title } : {}],
  }),

  component: RouteComponent,
});

const omit = <T extends Record<string, unknown>, K extends keyof T>(
  object: T,
  keys: K[],
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(object).filter(([key]) => !(keys as string[]).includes(key)),
  ) as Omit<T, K>;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();

  const parameters: UserListFilters = {
    ...(search.admin !== undefined && { admin: search.admin }),
    ...(search.status && { status: search.status }),
  };

  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery(
      usersInfiniteQuery(credentials.serverName, parameters),
    );

  const totalCount = data.pages[0]?.meta.count ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Page.Header>
        <Page.Title>
          <FormattedMessage
            id="pages.users.title"
            defaultMessage="Users"
            description="The title of the users list page"
          />
        </Page.Title>
        <Page.Search placeholder="Non-functional search" />
        <Page.Controls>
          <Page.LinkButton to="/" variant="secondary" Icon={DownloadIcon}>
            <FormattedMessage
              id="action.export"
              defaultMessage="Export"
              description="The label for the export action/button"
            />
          </Page.LinkButton>
          <Page.LinkButton to="/" variant="primary" Icon={UserAddIcon}>
            <FormattedMessage
              id="action.add"
              defaultMessage="Add"
              description="The label for the add action/button"
            />
          </Page.LinkButton>
        </Page.Controls>
      </Page.Header>

      {/* Filters */}
      <div className="flex gap-4">
        <ChatFilterLink
          selected={search.admin === true}
          to={Route.fullPath}
          search={
            search.admin === true
              ? omit(search, ["admin"])
              : {
                  ...search,
                  admin: true,
                }
          }
        >
          Admin Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.status === "active"}
          to={Route.fullPath}
          search={
            search.status === "active"
              ? omit(search, ["status"])
              : {
                  ...search,
                  status: "active",
                }
          }
        >
          Active Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.status === "locked"}
          to={Route.fullPath}
          search={
            search.status === "locked"
              ? omit(search, ["status"])
              : {
                  ...search,
                  status: "locked",
                }
          }
        >
          Locked Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.status === "deactivated"}
          to={Route.fullPath}
          search={
            search.status === "deactivated"
              ? omit(search, ["status"])
              : {
                  ...search,
                  status: "deactivated",
                }
          }
        >
          Deactivated Only
        </ChatFilterLink>
      </div>

      <Table.Root>
        <Table.Header>
          <Table.Title>
            <FormattedMessage
              id="pages.users.user_count"
              defaultMessage="{COUNT, plural, zero {No users} one {# user} other {# users}}"
              description="On the user list page, this heading shows the total number of users"
              values={{ COUNT: totalCount }}
            />
          </Table.Title>
        </Table.Header>

        <Table.List>
          <Table.ListHeader>
            <Table.ListHeaderCell>Matrix ID</Table.ListHeaderCell>
            <Table.ListHeaderCell>Account Type</Table.ListHeaderCell>
            <Table.ListHeaderCell>Created at</Table.ListHeaderCell>
          </Table.ListHeader>

          <Table.ListBody>
            {data.pages.map((page) => (
              <Fragment key={page.links.self}>
                {page.data.map((user) => (
                  <Table.ListRow key={user.id} clickable>
                    <Table.ListCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <Link
                            to="/users/$userId"
                            params={{ userId: user.id }}
                            className="text-text-link-external hover:underline"
                          >
                            <Text weight="semibold" size="md">
                              {user.attributes.username}
                            </Text>
                          </Link>
                          <Text size="sm" className="text-text-secondary">
                            Display name
                          </Text>
                        </div>
                      </div>
                    </Table.ListCell>
                    <Table.ListCell>
                      <Badge kind={user.attributes.admin ? "green" : "grey"}>
                        {user.attributes.admin ? "Admin" : "Local"}
                      </Badge>
                    </Table.ListCell>
                    <Table.ListCell>
                      <Text size="sm" className="text-text-secondary">
                        {/* TODO: format this with the user's locale */}
                        {computeHumanReadableDateTimeStringFromUtc(
                          user.attributes.created_at,
                        )}
                      </Text>
                    </Table.ListCell>
                  </Table.ListRow>
                ))}
              </Fragment>
            ))}
          </Table.ListBody>
        </Table.List>
      </Table.Root>

      <Button
        kind="secondary"
        disabled={!hasNextPage || isFetchingNextPage}
        size="lg"
        onClick={() => fetchNextPage()}
      >
        {isFetchingNextPage ? "Loading..." : "Load more"}
      </Button>
    </div>
  );
}
