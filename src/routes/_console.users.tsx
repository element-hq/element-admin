/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  MatchRoute,
  Outlet,
} from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { UserAddIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Avatar,
  Badge,
  CheckboxMenuItem,
  Form,
  InlineSpinner,
  Text,
} from "@vector-im/compound-web";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import { createUser, isErrorResponse, usersInfiniteQuery } from "@/api/mas";
import type { UserListFilters } from "@/api/mas";
import type { SingleResourceForUser } from "@/api/mas/api/types.gen";
import {
  mediaThumbnailQuery,
  profileQuery,
  wellKnownQuery,
} from "@/api/matrix";
import * as Dialog from "@/components/dialog";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as Table from "@/components/table";
import AppFooter from "@/ui/footer";
import AppNavigation from "@/ui/navigation";
import { useImageBlob } from "@/utils/blob";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

const UserSearchParameters = v.object({
  admin: v.optional(v.boolean()),
  status: v.optional(v.picklist(["active", "locked", "deactivated"])),
});

const titleMessage = defineMessage({
  id: "pages.users.title",
  defaultMessage: "Users",
  description: "The title of the users list page",
});

export const Route = createFileRoute("/_console/users")({
  validateSearch: UserSearchParameters,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials, intl },
    deps: { search },
  }) => {
    await queryClient.ensureQueryData(wellKnownQuery(credentials.serverName));

    const parameters: UserListFilters = {
      ...(search.admin !== undefined && { admin: search.admin }),
      ...(search.status && { status: search.status }),
    };

    await queryClient.ensureInfiniteQueryData(
      usersInfiniteQuery(credentials.serverName, parameters),
    );

    return {
      title: intl.formatMessage(titleMessage),
    };
  },

  head: ({ loaderData }) => ({
    meta: [loaderData ? { title: loaderData.title } : {}],
  }),

  pendingComponent: () => (
    <Navigation.Root>
      <AppNavigation />

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
      <Outlet />
    </Navigation.Root>
  ),

  component: RouteComponent,
});

const omit = <T extends Record<string, unknown>, K extends keyof T>(
  object: T,
  keys: K[],
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(object).filter(([key]) => !(keys as string[]).includes(key)),
  ) as Omit<T, K>;

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
  return (
    <Link
      to="/users/$userId"
      params={{ userId }}
      resetScroll={false}
      className="flex items-center gap-3"
    >
      <Avatar id={mxid} name={displayName || mxid} src={avatar} size="32px" />
      <div className="flex flex-1 flex-col min-w-0">
        {displayName ? (
          <>
            <Text size="md" weight="semibold" className="text-text-primary">
              {mxid}
            </Text>
            <Text size="sm" className="text-text-secondary">
              {displayName}
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
          <FormattedMessage
            id="action.add"
            defaultMessage="Add"
            description="The label for the add action/button"
          />
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

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();

  const parameters: UserListFilters = {
    ...(search.admin !== undefined && { admin: search.admin }),
    ...(search.status && { status: search.status }),
  };

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      usersInfiniteQuery(credentials.serverName, parameters),
    );

  // Flatten the array of arrays from the useInfiniteQuery hook
  const flatData = useMemo(
    () => data?.pages?.flatMap((page) => page.data) ?? [],
    [data],
  );

  const totalCount = data.pages[0]?.meta.count ?? 0;
  const totalFetched = flatData.length;

  const navigate = Route.useNavigate();

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
        id: "accountType",
        header: "Account Type",
        cell: ({ row }) => {
          const user = row.original;
          return (
            <Badge kind={user.attributes.admin ? "green" : "grey"}>
              {user.attributes.admin ? "Admin" : "Local"}
            </Badge>
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
    ],
    [credentials.serverName, synapseRoot],
  );

  const table = useReactTable({
    data: flatData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    debugTable: false,
  });

  const { rows } = table.getRowModel();

  // Called on scroll to fetch more data as the user scrolls
  const fetchMoreOnBottomReached = useCallback(() => {
    if (globalThis.window !== undefined) {
      const { scrollY, innerHeight } = globalThis.window;
      const { scrollHeight } = document.documentElement;

      // Once the user has scrolled within 1000px of the bottom, fetch more data
      if (
        scrollHeight - scrollY - innerHeight < 1000 &&
        !isFetching &&
        hasNextPage &&
        totalFetched < totalCount
      ) {
        fetchNextPage();
      }
    }
  }, [fetchNextPage, isFetching, hasNextPage, totalFetched, totalCount]);

  // Set up scroll listener
  useEffect(() => {
    const handleScroll = () => {
      fetchMoreOnBottomReached();
    };

    window.addEventListener("scroll", handleScroll);
    // Check on mount if we need to fetch more
    fetchMoreOnBottomReached();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [fetchMoreOnBottomReached]);

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 56,
    overscan: 20,
  });

  return (
    <Navigation.Root>
      <AppNavigation />

      <Outlet />

      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
            <Page.Controls>
              <UserAddButton serverName={credentials.serverName} />
            </Page.Controls>
          </Page.Header>

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

              <Table.Filter>
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.admin === true
                          ? omit(search, ["admin"])
                          : {
                              ...search,
                              admin: true,
                            },
                    });
                  }}
                  label="Admins"
                  checked={search.admin === true}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.status === "active"
                          ? omit(search, ["status"])
                          : {
                              ...search,
                              status: "active",
                            },
                    });
                  }}
                  label="Active users"
                  checked={search.status === "active"}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.status === "locked"
                          ? omit(search, ["status"])
                          : {
                              ...search,
                              status: "locked",
                            },
                    });
                  }}
                  label="Locked users"
                  checked={search.status === "locked"}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.status === "deactivated"
                          ? omit(search, ["status"])
                          : {
                              ...search,
                              status: "deactivated",
                            },
                    });
                  }}
                  label="Deactivated users"
                  checked={search.status === "deactivated"}
                />
              </Table.Filter>
            </Table.Header>

            <Table.List
              style={{
                // 40px is the height of the table header
                height: `${rowVirtualizer.getTotalSize() + 40}px`,
              }}
            >
              <Table.ListHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <Fragment key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <Table.ListHeaderCell key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </Table.ListHeaderCell>
                    ))}
                  </Fragment>
                ))}
              </Table.ListHeader>

              <Table.ListBody>
                {rowVirtualizer.getVirtualItems().map((virtualRow, index) => {
                  const row = rows[virtualRow.index];
                  if (!row)
                    throw new Error("got a virtual row for a non-existing row");

                  return (
                    <MatchRoute
                      key={row.id}
                      from={Route.path}
                      to="$userId"
                      params={{ userId: row.original.id }}
                    >
                      {(match) => (
                        <Table.ListRow
                          selected={!!match}
                          style={{
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${
                              virtualRow.start - index * virtualRow.size
                            }px)`,
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <Table.ListCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </Table.ListCell>
                          ))}
                        </Table.ListRow>
                      )}
                    </MatchRoute>
                  );
                })}
              </Table.ListBody>
            </Table.List>

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
    </Navigation.Root>
  );
}
