// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useDebouncedCallback } from "@tanstack/react-pacer";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { UserAddIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Avatar,
  Badge,
  CheckboxMenuItem,
  Form,
  InlineSpinner,
  Text,
} from "@vector-im/compound-web";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import {
  createUser,
  isErrorResponse,
  oauth2ClientQuery,
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
import * as DataTable from "@/components/data-table";
import * as Dialog from "@/components/dialog";
import { TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import { useImageBlob } from "@/utils/blob";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";
import { useFilters } from "@/utils/filters";
import { useCurrentChildRoutePath } from "@/utils/routes";

const features = tableFeatures({});
const columnHelper = createColumnHelper<
  typeof features,
  SingleResourceForUser
>();

const UserSearchParameters = v.object({
  admin: v.optional(v.boolean()),
  guest: v.optional(v.boolean()),
  status: v.optional(v.picklist(["active", "locked", "deactivated"])),
  search: v.optional(v.string()),
  client: v.optional(v.array(v.string())),
  legacy: v.optional(v.boolean()),
  dir: v.optional(v.picklist(["forward", "backward"])),
});

type UserSearch = v.InferOutput<typeof UserSearchParameters>;

const titleMessage = defineMessage({
  id: "pages.users.title",
  defaultMessage: "Users",
  description: "The title of the users list page",
});

const columnMessages = {
  matrix_id: defineMessage({
    id: "pages.users.columns.matrix_id",
    defaultMessage: "Matrix ID",
    description: "Column header for the Matrix ID in the users list table",
  }),
  created_at: defineMessage({
    id: "pages.users.columns.created_at",
    defaultMessage: "Created at",
    description:
      "Column header for the account creation date in the users list table",
  }),
  account_status: defineMessage({
    id: "pages.users.columns.account_status",
    defaultMessage: "Account status",
    description: "Column header for the account status in the users list table",
  }),
};

const accountStatusMessages = {
  deactivated: defineMessage({
    id: "pages.users.account_status.deactivated",
    defaultMessage: "Deactivated",
    description:
      "Badge label for a deactivated user account in the users list table",
  }),
  locked: defineMessage({
    id: "pages.users.account_status.locked",
    defaultMessage: "Locked",
    description:
      "Badge label for a locked user account in the users list table",
  }),
  guest: defineMessage({
    id: "pages.users.account_status.guest",
    defaultMessage: "Guest",
    description:
      "Badge label for a legacy guest user account in the users list table",
  }),
  admin: defineMessage({
    id: "pages.users.account_status.admin",
    defaultMessage: "Admin",
    description:
      "Badge label for an admin user account in the users list table",
  }),
  active: defineMessage({
    id: "pages.users.account_status.active",
    defaultMessage: "Active",
    description:
      "Badge label for an active user account in the users list table",
  }),
};

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
      ...(search.client &&
        search.client.length > 0 && { activeOauth2Client: search.client }),
      ...(search.legacy !== undefined && {
        hasActiveCompatSession: search.legacy,
      }),
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
    <DataTable.RowLink
      to="/users/$userId"
      params={{ userId }}
      search={search}
      resetScroll={false}
      className="flex items-center gap-3"
    >
      <Avatar id={mxid} name={displayName || mxid} src={avatar} size="32px" />
      <div className="flex flex-1 flex-col min-w-0 max-w-96">
        {displayName ? (
          <>
            <Text
              size="md"
              weight="semibold"
              className="text-text-primary truncate"
            >
              {displayName}
            </Text>
            <Text size="sm" className="text-text-secondary truncate">
              {mxid}
            </Text>
          </>
        ) : (
          <Text
            size="md"
            weight="semibold"
            className="text-text-primary truncate"
          >
            {mxid}
          </Text>
        )}
      </div>
    </DataTable.RowLink>
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
      // Set the user query data so that we avoid one round trip
      queryClient.setQueryData(
        ["mas", "user", serverName, response.data.id],
        response,
      );

      toast.success(
        intl.formatMessage({
          id: "pages.users.new_user.success_message",
          defaultMessage: "User created",
          description:
            "The success message shown in a toast when a user is created",
        }),
      );

      // Invalidate the user list queries
      queryClient.invalidateQueries({
        queryKey: ["mas", "users", serverName],
      });

      await navigate({
        to: "./$userId",
        params: { userId: response.data.id },
        // Keep existing search parameters
        search: (previous) => previous,
      });
      setOpen(false);
      setLocalpart("");
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
      setLocalpart("");
    },
    [isPending],
  );

  const onLocalpartInput = useCallback(
    (event: React.InputEvent<HTMLInputElement>) => {
      setLocalpart(event.currentTarget.value);
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
            pattern="[a-z0-9.=_/-]+"
            autoCapitalize="off"
            autoComplete="off"
          />
          <Form.HelpMessage>
            {/* oxlint-disable-next-line formatjs/no-literal-string-in-jsx -- Matrix ID format preview, not translatable */}
            @{localpart || "---"}:{serverName}
          </Form.HelpMessage>
          <Form.ErrorMessage match="patternMismatch">
            <FormattedMessage
              id="pages.users.new_user.invalid_localpart"
              defaultMessage="Localpart can only contain lowercase letters, numbers, dots, underscores, dashes and slashes"
              description="The error message shown when the localpart contains invalid characters"
            />
          </Form.ErrorMessage>
          <Form.ErrorMessage match="valueMissing">
            <FormattedMessage
              id="pages.users.new_user.required_error"
              defaultMessage="This field is required"
              description="The error message shown when the localpart input is empty"
            />
          </Form.ErrorMessage>
          <Form.ErrorMessage match={(value) => /^[0-9]+$/.test(value)}>
            <FormattedMessage
              id="pages.users.new_user.invalid_localpart_numeric_only"
              defaultMessage="Localpart cannot only contain numbers"
              description="The error message shown when the localpart input only has numbers, which are reserved for guests"
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
      id="pages.users.filters.active_client_chip"
      defaultMessage="Has active device on: {name}"
      description="Active filter chip showing the currently filtered application in the user list"
      values={{
        name: client.attributes.client_name ?? client.attributes.client_id,
      }}
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
  {
    key: "legacy",
    value: true,
    message: defineMessage({
      id: "pages.users.filters.has_legacy_session",
      defaultMessage: "Has active legacy device",
      description:
        "The label for the 'has an active legacy device' filter in the user list",
    }),
  },
  {
    key: "legacy",
    value: false,
    message: defineMessage({
      id: "pages.users.filters.no_legacy_session",
      defaultMessage: "No active legacy device",
      description:
        "The label for the 'no active legacy device' filter in the user list",
    }),
  },
] as const;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const { direction, parameters } = Route.useLoaderDeps();
  const intl = useIntl();
  const from = useCurrentChildRoutePath(Route.id);
  const navigate = useNavigate({ from });

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const { data: totalCount } = useQuery({
    ...usersCountQuery(credentials.serverName, parameters),
    placeholderData: keepPreviousData,
  });

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
      key: "user-search",
      wait: 200,
    },
  );

  const onSearch = useCallback(
    (event: React.InputEvent<HTMLInputElement>) => {
      debouncedSearch(event.currentTarget.value);
    },
    [debouncedSearch],
  );

  const filters = useFilters(search, filtersDefinition);

  // Column definitions
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "matrixId",
          header: intl.formatMessage(columnMessages.matrix_id),
          meta: { width: DataTable.columnWidth.primary },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const user = row.original;
            // TODO: factor this out
            const mxid = `@${user.attributes.username}:${credentials.serverName}`;
            return (
              <UserCell
                userId={user.id}
                mxid={mxid}
                synapseRoot={synapseRoot}
              />
            );
          },
        }),
        columnHelper.display({
          id: "createdAt",
          header: intl.formatMessage(columnMessages.created_at),
          meta: { width: DataTable.columnWidth.date },
          // oxlint-disable-next-line react/no-unstable-nested-components
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
        }),
        columnHelper.display({
          id: "status",
          header: intl.formatMessage(columnMessages.account_status),
          meta: { width: DataTable.columnWidth.status },
          // oxlint-disable-next-line react/no-unstable-nested-components
          cell: ({ row }) => {
            const user = row.original;
            if (user.attributes.deactivated_at) {
              return (
                <Badge kind="red">
                  {intl.formatMessage(accountStatusMessages.deactivated)}
                </Badge>
              );
            }

            if (user.attributes.locked_at) {
              return (
                <Badge kind="grey">
                  {intl.formatMessage(accountStatusMessages.locked)}
                </Badge>
              );
            }

            if (user.attributes.legacy_guest) {
              return (
                <Badge kind="grey">
                  {intl.formatMessage(accountStatusMessages.guest)}
                </Badge>
              );
            }

            if (user.attributes.admin) {
              return (
                <Badge kind="green">
                  {intl.formatMessage(accountStatusMessages.admin)}
                </Badge>
              );
            }

            return (
              <Badge kind="default">
                {intl.formatMessage(accountStatusMessages.active)}
              </Badge>
            );
          },
        }),
      ]),
    [credentials.serverName, synapseRoot, intl],
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

          <DataTable.Root>
            <DataTable.Header>
              <DataTable.Title>
                {totalCount === undefined ? (
                  <Placeholder.LoadingText />
                ) : (
                  <FormattedMessage
                    id="pages.users.user_count"
                    defaultMessage="{COUNT, plural, =0 {No users} one {# user} other {# users}}"
                    description="On the user list page, this heading shows the total number of users"
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

              {(filters.active.length > 0 ||
                (search.client && search.client.length > 0)) && (
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

                  {search.client?.map((clientId) => {
                    const remaining = (search.client ?? []).filter(
                      (id) => id !== clientId,
                    );
                    const next: UserSearch = {
                      ...search,
                      client: remaining.length > 0 ? remaining : undefined,
                    };
                    return (
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
                          search={next}
                        />
                      </DataTable.ActiveFilter>
                    );
                  })}

                  <TextLink
                    from={from}
                    replace={true}
                    search={{ ...filters.clearedState, client: undefined }}
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
