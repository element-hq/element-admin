/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  CloseIcon,
  PlusIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Badge,
  Button,
  CheckboxMenuItem,
  Form,
  InlineSpinner,
  Text,
} from "@vector-im/compound-web";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import {
  type CreateTokenParameters,
  createRegistrationToken,
  registrationTokensInfiniteQuery,
  type TokenListParameters,
} from "@/api/mas";
import type { SingleResourceForUserRegistrationToken } from "@/api/mas/api/types.gen";
import { CopyToClipboard } from "@/components/copy";
import * as Dialog from "@/components/dialog";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as Table from "@/components/table";
import AppFooter from "@/ui/footer";
import AppNavigation from "@/ui/navigation";
import {
  computeHumanReadableDateTimeStringFromUtc,
  computeUtcIsoStringFromLocal,
} from "@/utils/datetime";

const TokenSearchParameters = v.object({
  used: v.optional(v.boolean()),
  revoked: v.optional(v.boolean()),
  expired: v.optional(v.boolean()),
  valid: v.optional(v.boolean()),
});

const titleMessage = defineMessage({
  id: "pages.registration_tokens.title",
  defaultMessage: "Registration tokens",
  description: "The title of the registration tokens list page",
});

export const Route = createFileRoute("/_console/registration-tokens")({
  validateSearch: TokenSearchParameters,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials, intl },
    deps: { search },
  }) => {
    const parameters: Omit<
      TokenListParameters,
      "after" | "before" | "first" | "last"
    > = {
      ...(search.used !== undefined && { used: search.used }),
      ...(search.revoked !== undefined && { revoked: search.revoked }),
      ...(search.expired !== undefined && { expired: search.expired }),
      ...(search.valid !== undefined && { valid: search.valid }),
    };

    await queryClient.ensureInfiniteQueryData(
      registrationTokensInfiniteQuery(credentials.serverName, parameters),
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
            <Page.Controls>
              <Page.Button Icon={PlusIcon}>
                <FormattedMessage
                  id="action.add"
                  defaultMessage="Add"
                  description="The label for the add action/button"
                />
              </Page.Button>
            </Page.Controls>
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

function getTokenStatus(token: {
  valid: boolean;
  expires_at?: string | null;
  usage_limit?: number | null;
  times_used: number;
  revoked_at?: string | null;
}) {
  if (!token.valid) {
    if (token.revoked_at) {
      return "Revoked";
    }
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return "Expired";
    }
    if (
      token.usage_limit !== null &&
      token.usage_limit !== undefined &&
      token.times_used >= token.usage_limit
    ) {
      return "Used Up";
    }
    return "Invalid";
  }
  return "Active";
}

interface TokenAddButtonProps {
  serverName: string;
}

const TokenAddButton: React.FC<TokenAddButtonProps> = ({
  serverName,
}: TokenAddButtonProps) => {
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const intl = useIntl();

  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const customTokenInputRef = useRef<HTMLInputElement>(null);
  const usageLimitInputRef = useRef<HTMLInputElement>(null);
  const expiresInputRef = useRef<HTMLInputElement>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: (parameters: CreateTokenParameters) =>
      createRegistrationToken(queryClient, serverName, parameters),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.registration_tokens.create_token.error",
          defaultMessage: "Failed to create token",
          description:
            "The error message when the request for creating a registration token fails",
        }),
      );
    },
    onSuccess: async (response) => {
      toast.success(
        intl.formatMessage({
          id: "pages.registration_tokens.create_token.success",
          defaultMessage: "Token created successfully",
          description: "The success message for creating a registration token",
        }),
      );

      await navigate({
        to: "/registration-tokens/$tokenId",
        params: { tokenId: response.data.id },
      });
      setOpen(false);
      formRef.current?.reset();
    },
  });

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (isPending) {
        return;
      }
      setOpen(open);
      if (!open) {
        formRef.current?.reset();
      }
    },
    [isPending],
  );

  const clearCustomToken = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (customTokenInputRef.current) {
        customTokenInputRef.current.value = "";
      }
    },
    [],
  );

  const clearUsageLimit = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (usageLimitInputRef.current) {
        usageLimitInputRef.current.value = "";
      }
    },
    [],
  );

  const clearExpiration = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (expiresInputRef.current) {
        expiresInputRef.current.value = "";
      }
    },
    [],
  );

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPending) {
        return;
      }

      const formData = new FormData(event.currentTarget);
      const parameters: CreateTokenParameters = {};

      const customTokenValue = formData.get("customToken") as string;
      if (customTokenValue && customTokenValue.trim() !== "") {
        parameters.token = customTokenValue.trim();
      }

      const usageLimitValue = formData.get("usageLimit") as string;
      if (usageLimitValue && !Number.isNaN(Number(usageLimitValue))) {
        parameters.usage_limit = Number(usageLimitValue);
      }

      const expires = formData.get("expires") as string;
      if (expires) {
        parameters.expires_at = computeUtcIsoStringFromLocal(expires);
      }

      mutate(parameters);
    },
    [mutate, isPending],
  );

  return (
    <Dialog.Root
      onOpenChange={onOpenChange}
      open={open}
      trigger={
        <Page.Button Icon={PlusIcon}>
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
          id="pages.registration_tokens.create_token.title"
          defaultMessage="Create Registration Token"
          description="The title of the create registration token dialog"
        />
      </Dialog.Title>

      <Dialog.Description asChild>
        <Form.Root ref={formRef} onSubmit={onSubmit}>
          <Form.Field name="customToken">
            <Form.Label>Custom Token</Form.Label>
            <div className="flex items-center gap-3">
              <Form.TextControl
                type="text"
                ref={customTokenInputRef}
                className="flex-1"
                placeholder="Auto-generate if left empty"
                disabled={isPending}
              />
              <Button
                type="button"
                iconOnly
                kind="secondary"
                onClick={clearCustomToken}
                Icon={CloseIcon}
                disabled={isPending}
              />
            </div>
            <Form.HelpMessage>
              Optional custom token string. If left empty, a secure token will
              be auto-generated.
            </Form.HelpMessage>
          </Form.Field>

          <Form.Field name="usageLimit">
            <Form.Label>Usage Limit</Form.Label>
            <div className="flex items-center gap-3">
              <Form.TextControl
                type="number"
                ref={usageLimitInputRef}
                className="flex-1"
                placeholder="Leave empty for unlimited uses"
                min="1"
                disabled={isPending}
              />
              <Button
                type="button"
                iconOnly
                kind="secondary"
                onClick={clearUsageLimit}
                Icon={CloseIcon}
                disabled={isPending}
              />
            </div>
            <Form.HelpMessage>
              Maximum number of times this token can be used. Leave empty for
              unlimited uses.
            </Form.HelpMessage>
          </Form.Field>

          <Form.Field name="expires">
            <Form.Label>Expires at</Form.Label>
            <div className="flex items-center gap-3">
              <Form.TextControl
                type="datetime-local"
                ref={expiresInputRef}
                className="flex-1"
                placeholder="No expiration"
                disabled={isPending}
              />
              <Button
                type="button"
                iconOnly
                kind="secondary"
                onClick={clearExpiration}
                Icon={CloseIcon}
                disabled={isPending}
              />
            </div>
            <Form.HelpMessage>
              When the token expires. Leave empty if the token should never
              expire.
            </Form.HelpMessage>
          </Form.Field>

          <Form.Submit disabled={isPending}>
            {isPending && <InlineSpinner />}
            <FormattedMessage
              id="pages.registration_tokens.create_token.submit"
              defaultMessage="Create Token"
              description="The submit button text in the create registration token dialog"
            />
          </Form.Submit>
        </Form.Root>
      </Dialog.Description>

      <Dialog.Close asChild>
        <Button type="button" kind="tertiary" disabled={isPending}>
          <FormattedMessage
            id="action.cancel"
            defaultMessage="Cancel"
            description="Label for a cancel action/button"
          />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
  );
};

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const parameters: Omit<
    TokenListParameters,
    "after" | "before" | "first" | "last"
  > = {
    ...(search.used !== undefined && { used: search.used }),
    ...(search.revoked !== undefined && { revoked: search.revoked }),
    ...(search.expired !== undefined && { expired: search.expired }),
    ...(search.valid !== undefined && { valid: search.valid }),
  };

  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      registrationTokensInfiniteQuery(credentials.serverName, parameters),
    );

  // Flatten the array of arrays from the useInfiniteQuery hook
  const flatData = useMemo(
    () => data?.pages?.flatMap((page) => page.data) ?? [],
    [data],
  );

  const totalCount = data.pages[0]?.meta.count ?? 0;
  const totalFetched = flatData.length;

  // Column definitions
  const columns = useMemo<ColumnDef<SingleResourceForUserRegistrationToken>[]>(
    () => [
      {
        id: "token",
        header: "Token",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <div className="flex items-center gap-2">
              <Link
                to="/registration-tokens/$tokenId"
                params={{ tokenId: token.id }}
                resetScroll={false}
              >
                <Text
                  size="md"
                  weight="semibold"
                  className="text-text-secondary"
                >
                  {token.attributes.token}
                </Text>
              </Link>
              <CopyToClipboard value={token.attributes.token} />
            </div>
          );
        },
      },
      {
        id: "createdAt",
        header: "Created At",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {computeHumanReadableDateTimeStringFromUtc(
                token.attributes.created_at,
              )}
            </Text>
          );
        },
      },
      {
        id: "validUntil",
        header: "Valid Until",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {token.attributes.expires_at
                ? computeHumanReadableDateTimeStringFromUtc(
                    token.attributes.expires_at,
                  )
                : "Never expires"}
            </Text>
          );
        },
      },
      {
        id: "uses",
        header: "Uses",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {token.attributes.times_used} /{" "}
              {token.attributes.usage_limit || "∞"}
            </Text>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Badge kind={token.attributes.valid ? "green" : "red"}>
              {getTokenStatus(token.attributes)}
            </Badge>
          );
        },
      },
    ],
    [],
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

      <Navigation.Content>
        <Navigation.Main>
          <Page.Header>
            <Page.Title>
              <FormattedMessage {...titleMessage} />
            </Page.Title>
            <Page.Controls>
              <TokenAddButton serverName={credentials.serverName} />
            </Page.Controls>
          </Page.Header>

          <Table.Root>
            <Table.Header>
              <Table.Title>
                <FormattedMessage
                  id="pages.registration_tokens.token_count"
                  defaultMessage="{COUNT, plural, zero {No tokens} one {# token} other {# tokens}}"
                  description="On the registration tokens list page, this heading shows the total number of tokens"
                  values={{ COUNT: totalCount }}
                />
              </Table.Title>

              <Table.Filter>
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.valid === true
                          ? omit(search, ["valid"])
                          : {
                              ...search,
                              valid: true,
                            },
                    });
                  }}
                  label="Active Only"
                  checked={search.valid === true}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.used === true
                          ? omit(search, ["used"])
                          : {
                              ...search,
                              used: true,
                            },
                    });
                  }}
                  label="Used Only"
                  checked={search.used === true}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.revoked === true
                          ? omit(search, ["revoked"])
                          : {
                              ...search,
                              revoked: true,
                            },
                    });
                  }}
                  label="Revoked Only"
                  checked={search.revoked === true}
                />
                <CheckboxMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    navigate({
                      search:
                        search.expired === true
                          ? omit(search, ["expired"])
                          : {
                              ...search,
                              expired: true,
                            },
                    });
                  }}
                  label="Expired Only"
                  checked={search.expired === true}
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
                    <Table.ListRow
                      key={row.id}
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
                  );
                })}
              </Table.ListBody>
            </Table.List>

            {/* Loading indicator */}
            {isFetching && (
              <div className="flex justify-center py-4">
                <Text size="sm" className="text-text-secondary">
                  Loading more tokens...
                </Text>
              </div>
            )}
          </Table.Root>
        </Navigation.Main>
        <AppFooter />
      </Navigation.Content>

      <Outlet />
    </Navigation.Root>
  );
}
