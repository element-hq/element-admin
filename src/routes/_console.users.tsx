// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { UserAddIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Avatar,
  Badge,
  CheckboxMenuItem,
  Form,
  InlineSpinner,
  Text,
} from "@vector-im/compound-web";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import {
  createUser,
  isErrorResponse,
  usersCountQuery,
  usersInfiniteQuery,
} from "@/api/mas";
import type { UserListFilters } from "@/api/mas";
import type { SingleResourceForUser } from "@/api/mas/api/types.gen";
import {
  mediaThumbnailQuery,
  profileQuery,
  wellKnownQuery,
} from "@/api/matrix";
import * as Dialog from "@/components/dialog";
import { TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as Table from "@/components/table";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import { useImageBlob } from "@/utils/blob";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";
import { useFilters } from "@/utils/filters";

const UserSearchParameters = v.object({
  admin: v.optional(v.boolean()),
  guest: v.optional(v.boolean()),
  status: v.optional(v.picklist(["active", "locked", "deactivated"])),
  search: v.optional(v.string()),
  dir: v.optional(v.picklist(["forward", "backward"])),
});

const titleMessage = defineMessage({
  id: "pages.users.title",
  defaultMessage: "Users",
  description: "The title of the users list page",
});

export const Route = createFileRoute("/_console/users")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  validateSearch: UserSearchParameters,

  loaderDeps: ({ search }) => {
    const parameters: UserListFilters = {
      ...(search.admin !== undefined && { admin: search.admin }),
      ...(search.guest !== undefined && { guest: search.guest }),
      ...(search.status && { status: search.status }),
      ...(search.search && { search: search.search }),
    };

    return { parameters, direction: search.dir };
  },
  loader: async ({
    context: { queryClient, credentials },
    deps: { parameters, direction },
  }) => {
    // Kick-off the users count query without awaiting it
    queryClient.prefetchQuery(
      usersCountQuery(credentials.serverName, parameters),
    );

    await queryClient.ensureQueryData(wellKnownQuery(credentials.serverName));

    await queryClient.ensureInfiniteQueryData(
      usersInfiniteQuery(credentials.serverName, parameters, direction),
    );
  },

  pendingComponent: () => (
    <>
      <Outlet />

      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
          </Page.Header>

          <Placeholder.LoadingTable />
        </Navigation.Main>

        <AppFooter />
      </Navigation.Content>
    </>
  ),

  component: RouteComponent,
});

const useUserAvatar = (
  synapseRoot: string,
  userId: string,
): string | undefined => {
  const { data: profile } = useQuery(profileQuery(synapseRoot, userId));
  const { data: avatarBlob } = useQuery(
    mediaThumbnailQuery(synapseRoot, profile?.avatar_url),
  );
  return useImageBlob(avatarBlob);
};

const useUserDisplayName = (
  synapseRoot: string,
  userId: string,
): string | undefined => {
  const { data: profile } = useQuery(profileQuery(synapseRoot, userId));
  return profile?.displayname;
};

interface UserCellProps {
  userId: string;
  mxid: string;
  synapseRoot: string;
}
const UserCell = ({ userId, mxid, synapseRoot }: UserCellProps) => {
  const displayName = useUserDisplayName(synapseRoot, mxid);
  const avatar = useUserAvatar(synapseRoot, mxid);
  const search = Route.useSearch();
  return (
    <Link
      to="/users/$userId"
      params={{ userId }}
      search={search}
      resetScroll={false}
      className="flex items-center gap-3"
    >
      <Avatar id={mxid} name={displayName || mxid} src={avatar} size="32px" />
      <div className="flex flex-1 flex-col min-w-0">
        {displayName ? (
          <>
            <Text size="md" weight="semibold" className="text-text-primary">
              {displayName}
            </Text>
            <Text size="sm" className="text-text-secondary">
              {mxid}
            </Text>
          </>
        ) : (
          <Text size="md" weight="semibold" className="text-text-primary">
            {mxid}
          </Text>
        )}
      </div>
    </Link>
  );
};

interface UserAddButtonProps {
  serverName: string;
}
const UserAddButton: React.FC<UserAddButtonProps> = ({
  serverName,
}: UserAddButtonProps) => {
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [localpart, setLocalpart] = useState("");

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: (username: string) =>
      createUser(queryClient, serverName, username),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.new_user.error_message",
          defaultMessage: "Error creating user",
          description:
            "The error message shown in a toast when a user fails to be created",
        }),
      );
    },
    onSuccess: async (response) => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.new_user.success_message",
          defaultMessage: "User created",
          description:
            "The success message shown in a toast when a user is created",
        }),
      );

      await navigate({
        to: "./$userId",
        params: { userId: response.data.id },
      });
      setOpen(false);
    },
  });

  // TODO: have a generic way to normalize those errors
  const errors = isErrorResponse(error)
    ? error.errors
    : error === null
      ? []
      : [{ title: error.message }];

  const onOpenChange = useCallback(
    (open: boolean) => {
      // Prevent from closing if the mutation is pending
      if (isPending) {
        return;
      }

      setOpen(open);
    },
    [isPending],
  );

  const onLocalpartInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setLocalpart(event.target.value);
    },
    [setLocalpart],
  );

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPending) {
        return;
      }

      const data = new FormData(event.currentTarget);
      const localpart = data.get("new-user-localpart") as string;
      mutate(localpart);
    },
    [mutate, isPending],
  );

  return (
    <Dialog.Root
      onOpenChange={onOpenChange}
      open={open}
      trigger={
        <Page.Button Icon={UserAddIcon}>
          <FormattedMessage {...messages.actionAdd} />
        </Page.Button>
      }
    >
      <Dialog.Title>
        <FormattedMessage
          id="pages.users.new_user.add_user"
          defaultMessage="Add user"
          description="The title of the add user dialog"
        />
      </Dialog.Title>

      <Dialog.Description>
        <FormattedMessage
          id="pages.users.new_user.description"
          defaultMessage="To add a new user to {serverName}, choose a user name for this user, which will be part of their user ID."
          description="The description of the add user dialog"
          values={{ serverName }}
        />
      </Dialog.Description>

      <Form.Root onSubmit={onSubmit}>
        <Form.Field name="new-user-localpart" serverInvalid={isError}>
          <Form.Label>
            <FormattedMessage
              id="pages.users.new_user.localpart"
              defaultMessage="Enter name"
              description="The label for the localpart input in the new user form. Careful with the value, some browsers (*cough* Safari) will trigger autocomplete (which we don't want!) if the input label has 'username' or 'user ID' in it"
            />
          </Form.Label>
          <Form.TextControl
            onInput={onLocalpartInput}
            required
            pattern="[a-z0-9_]+"
            autoCapitalize="off"
            autoComplete="off"
          />
          <Form.HelpMessage>
            @{localpart || "---"}:{serverName}
          </Form.HelpMessage>
          <Form.ErrorMessage match="patternMismatch">
            <FormattedMessage
              id="pages.users.new_user.invalid_localpart"
              defaultMessage="Localpart can only contain lowercase letters, numbers and underscores"
              description="The error message shown when the localpart input is empty"
            />
          </Form.ErrorMessage>
          <Form.ErrorMessage match="valueMissing">
            <FormattedMessage
              id="pages.users.new_user.required_error"
              defaultMessage="This field is required"
              description="The error message shown when the localpart input is empty"
            />
          </Form.ErrorMessage>

          {errors.map((error, index) => (
            <Form.ErrorMessage key={index}>{error.title}</Form.ErrorMessage>
          ))}
        </Form.Field>

        <Form.Submit disabled={isPending}>
          {isPending && <InlineSpinner />}
          <FormattedMessage
            id="pages.users.new_user.create_account"
            defaultMessage="Create account"
            description="The label for the create account button in the new user form"
          />
        </Form.Submit>
      </Form.Root>
    </Dialog.Root>
  );
};

const UserCount = ({ serverName }: { serverName: string }) => {
  const { parameters } = Route.useLoaderDeps();
  const { data: totalCount } = useSuspenseQuery(
    usersCountQuery(serverName, parameters),
  );

  return (
    <FormattedMessage
      id="pages.users.user_count"
      defaultMessage="{COUNT, plural, zero {No users} one {# user} other {# users}}"
      description="On the user list page, this heading shows the total number of users"
      values={{ COUNT: totalCount }}
    />
  );
};

const filtersDefinition = [
  {
    key: "dir",
    value: "backward",
    message: defineMessage({
      id: "pages.users.filters.newest_first",
      defaultMessage: "Newest first",
      description: "The label for the 'Newest first' filter in the user list",
    }),
  },
  {
    key: "admin",
    value: true,
    message: defineMessage({
      id: "pages.users.filters.admins",
      defaultMessage: "Admins",
      description: "The label for the 'Admins' filter in the user list",
    }),
  },
  {
    key: "guest",
    value: true,
    message: defineMessage({
      id: "pages.users.filters.guests",
      defaultMessage: "Guests (legacy)",
      description:
        "The label for the 'Guests (legacy)' filter in the user list",
    }),
  },
  {
    key: "guest",
    value: false,
    message: defineMessage({
      id: "pages.users.filters.non_guests",
      defaultMessage: "Non-guests (legacy)",
      description:
        "The label for the 'Non-guests (legacy)' filter in the user list",
    }),
  },
  {
    key: "status",
    value: "active",
    message: defineMessage({
      id: "pages.users.filters.active",
      defaultMessage: "Active users",
      description: "The label for the 'Active users' filter in the user list",
    }),
  },
  {
    key: "status",
    value: "locked",
    message: defineMessage({
      id: "pages.users.filters.locked",
      defaultMessage: "Locked users",
      description: "The label for the 'Locked users' filter in the user list",
    }),
  },
  {
    key: "status",
    value: "deactivated",
    message: defineMessage({
      id: "pages.users.filters.deactivated",
      defaultMessage: "Deactivated users",
      description:
        "The label for the 'Deactivated users' filter in the user list",
    }),
  },
] as const;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const { direction, parameters } = Route.useLoaderDeps();
  const navigate = Route.useNavigate();
  const intl = useIntl();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const isBackward = search.dir === "backward";
  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      usersInfiniteQuery(credentials.serverName, parameters, direction),
    );

  // Flatten the array of arrays from the useInfiniteQuery hook
  const flatData = useMemo(
    () =>
      data?.pages?.flatMap((page) =>
        isBackward ? page.data.toReversed() : page.data,
      ) ?? [],
    [data, isBackward],
  );

  const debouncedSearch = useDebouncedCallback(
    (term: string) => {
      navigate({
        replace: true,
        search: (previous) => {
          if (!term.trim()) {
            return { ...previous, search: undefined };
          }

          return { ...previous, search: term.trim() };
        },
      });
    },
    {
      wait: 200,
    },
  );

  const onSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      debouncedSearch(event.target.value);
    },
    [debouncedSearch],
  );

  const filters = useFilters(search, filtersDefinition);

  // Column definitions
  const columns = useMemo<ColumnDef<SingleResourceForUser>[]>(
    () => [
      {
        id: "matrixId",
        header: "Matrix ID",
        cell: ({ row }) => {
          const user = row.original;
          // TODO: factor this out
          const mxid = `@${user.attributes.username}:${credentials.serverName}`;
          return (
            <UserCell userId={user.id} mxid={mxid} synapseRoot={synapseRoot} />
          );
        },
      },
      {
        id: "createdAt",
        header: "Created at",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {computeHumanReadableDateTimeStringFromUtc(
                user.attributes.created_at,
              )}
            </Text>
          );
        },
      },
      {
        id: "status",
        header: "Account status",
        cell: ({ row }) => {
          const user = row.original;
          if (user.attributes.deactivated_at) {
            return <Badge kind="red">Deactivated</Badge>;
          }

          if (user.attributes.locked_at) {
            return <Badge kind="grey">Locked</Badge>;
          }

          if (user.attributes.legacy_guest) {
            return <Badge kind="grey">Guest</Badge>;
          }

          if (user.attributes.admin) {
            return <Badge kind="green">Admin</Badge>;
          }

          return <Badge kind="default">Active</Badge>;
        },
      },
    ],
    [credentials.serverName, synapseRoot],
  );

  const table = useReactTable({
    data: flatData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  // This prevents the compiler from optimizing the table
  // See https://github.com/TanStack/table/issues/5567
  const tableRef = useRef(table);

  return (
    <>
      <Outlet />

      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
            <Page.Search
              placeholder={intl.formatMessage({
                id: "pages.users.search_placeholder",
                defaultMessage: "Search users…",
                description: "The placeholder text for the user search input",
              })}
              onInput={onSearch}
              defaultValue={search.search}
            />
            <Page.Controls>
              <UserAddButton serverName={credentials.serverName} />
            </Page.Controls>
          </Page.Header>

          <Table.Root>
            <Table.Header>
              <Table.DynamicTitle>
                <UserCount serverName={credentials.serverName} />
              </Table.DynamicTitle>

              <Table.FilterMenu>
                {filters.all.map((filter) => (
                  <CheckboxMenuItem
                    key={filter.key}
                    onSelect={(event) => {
                      event.preventDefault();
                      navigate({ search: filter.toggledState });
                    }}
                    label={intl.formatMessage(filter.message)}
                    checked={filter.enabled}
                  />
                ))}
              </Table.FilterMenu>

              {filters.active.length > 0 && (
                <Table.ActiveFilterList>
                  {filters.active.map((filter) => (
                    <Table.ActiveFilter key={filter.key}>
                      <FormattedMessage {...filter.message} />
                      <Table.RemoveFilterLink
                        from={Route.fullPath}
                        replace={true}
                        search={filter.toggledState}
                      />
                    </Table.ActiveFilter>
                  ))}

                  <TextLink
                    from={Route.fullPath}
                    replace={true}
                    search={filters.clearedState}
                    size="small"
                  >
                    <FormattedMessage {...messages.actionClear} />
                  </TextLink>
                </Table.ActiveFilterList>
              )}
            </Table.Header>

            <Table.VirtualizedList
              table={tableRef.current}
              canFetchNextPage={hasNextPage && !isFetching}
              fetchNextPage={fetchNextPage}
            />

            {/* Loading indicator */}
            {isFetching && (
              <div className="flex justify-center py-4">
                <Text size="sm" className="text-text-secondary">
                  Loading more users...
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
