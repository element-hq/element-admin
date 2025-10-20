// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  useQueryClient,
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { PlusIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Badge,
  Button,
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
  type CreatePersonalSessionParameters,
  createPersonalSession,
  personalSessionsInfiniteQuery,
  type PersonalSessionListParameters,
  personalSessionsCountQuery,
} from "@/api/mas";
import type { SingleResourceForPersonalSession } from "@/api/mas/api/types.gen";
import { CopyToClipboard } from "@/components/copy";
import * as Dialog from "@/components/dialog";
import { TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as Table from "@/components/table";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";
import { useFilters } from "@/utils/filters";
import { useCurrentChildRoutePath } from "@/utils/routes";

const PersonalTokenSearchParameters = v.object({
  status: v.optional(v.picklist(["active", "revoked"])),
  actor_user: v.optional(v.string()),
  expires_before: v.optional(v.string()),
  expires_after: v.optional(v.string()),
});

const titleMessage = defineMessage({
  id: "pages.personal_tokens.title",
  defaultMessage: "Personal tokens",
  description: "The title of the personal tokens list page",
});

export const Route = createFileRoute("/_console/personal-tokens")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  validateSearch: PersonalTokenSearchParameters,

  loaderDeps: ({ search }) => ({
    parameters: {
      ...(search.status !== undefined && { status: search.status }),
      ...(search.actor_user !== undefined && { actor_user: search.actor_user }),
      ...(search.expires_before !== undefined && {
        expires_before: search.expires_before,
      }),
      ...(search.expires_after !== undefined && {
        expires_after: search.expires_after,
      }),
    } satisfies PersonalSessionListParameters,
  }),
  loader: async ({
    context: { queryClient, credentials },
    deps: { parameters },
  }) => {
    // Kick off the token count query without awaiting it
    queryClient.prefetchQuery(
      personalSessionsCountQuery(credentials.serverName, parameters),
    );

    await queryClient.ensureInfiniteQueryData(
      personalSessionsInfiniteQuery(credentials.serverName, parameters),
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
            <Page.Controls>
              <Page.Button disabled Icon={PlusIcon}>
                <FormattedMessage {...messages.actionAdd} />
              </Page.Button>
            </Page.Controls>
          </Page.Header>

          <Placeholder.LoadingTable />
        </Navigation.Main>
        <AppFooter />
      </Navigation.Content>
    </>
  ),

  component: RouteComponent,
});

interface PersonalTokenStatusBadgeProps {
  token: SingleResourceForPersonalSession["attributes"];
}

function PersonalTokenStatusBadge({
  token,
}: PersonalTokenStatusBadgeProps): React.ReactElement {
  if (token.revoked_at) {
    return (
      <Badge kind="grey">
        <FormattedMessage
          id="pages.personal_tokens.status.revoked"
          defaultMessage="Revoked"
          description="Status badge for revoked personal tokens"
        />
      </Badge>
    );
  }

  if (token.expires_at) {
    const expiryDate = new Date(token.expires_at);
    const now = new Date();
    if (expiryDate <= now) {
      return (
        <Badge kind="red">
          <FormattedMessage
            id="pages.personal_tokens.status.expired"
            defaultMessage="Expired"
            description="Status badge for expired personal tokens"
          />
        </Badge>
      );
    }
  }

  return (
    <Badge kind="green">
      <FormattedMessage
        id="pages.personal_tokens.status.active"
        defaultMessage="Active"
        description="Status badge for active personal tokens"
      />
    </Badge>
  );
}

interface PersonalTokenAddButtonProps {
  serverName: string;
}

const PersonalTokenAddButton = ({
  serverName,
}: PersonalTokenAddButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenResponse, setTokenResponse] = useState<{
    token: string;
    tokenName: string;
  } | null>(null);
  const queryClient = useQueryClient();
  const intl = useIntl();

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSubmitting(true);

      const formData = new FormData(event.currentTarget);
      const humanName = formData.get("human_name") as string;
      const actorUserId = formData.get("actor_user_id") as string;
      const scope = formData.get("scope") as string;
      const expiresInDays = formData.get("expires_in_days") as string;

      const parameters: CreatePersonalSessionParameters = {
        actor_user_id: actorUserId,
        human_name: humanName,
        scope,
      };

      if (expiresInDays && expiresInDays !== "") {
        parameters.expires_in =
          Number.parseInt(expiresInDays, 10) * 24 * 60 * 60; // Convert days to seconds
      }

      try {
        const result = await createPersonalSession(
          queryClient,
          serverName,
          parameters,
        );

        // Show the token once
        if (result.data.attributes.access_token) {
          setTokenResponse({
            token: result.data.attributes.access_token,
            tokenName: humanName,
          });
        }

        // Invalidate the list to refresh the data
        await queryClient.invalidateQueries({
          queryKey: ["mas", "personal-sessions", serverName],
        });

        toast.success(
          intl.formatMessage({
            id: "pages.personal_tokens.create_success",
            defaultMessage: "Personal token created successfully",
            description: "Success message when a personal token is created",
          }),
        );
      } catch (error) {
        console.error("Failed to create personal token:", error);
        toast.error(
          intl.formatMessage({
            id: "pages.personal_tokens.create_error",
            defaultMessage: "Failed to create personal token",
            description: "Error message when creating a personal token fails",
          }),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient, serverName, intl],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTokenResponse(null);
  }, []);

  return (
    <>
      <Button
        Icon={PlusIcon}
        onClick={() => setIsOpen(true)}
        size="sm"
        kind="primary"
      >
        <FormattedMessage
          id="pages.personal_tokens.add_token"
          defaultMessage="Add personal token"
          description="Button text to add a new personal token"
        />
      </Button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Title>
          {tokenResponse ? (
            <FormattedMessage
              id="pages.personal_tokens.token_created_title"
              defaultMessage="Personal token created"
              description="Title of the dialog when a personal token is successfully created"
            />
          ) : (
            <FormattedMessage
              id="pages.personal_tokens.add_token_title"
              defaultMessage="Add personal token"
              description="Title of the add personal token dialog"
            />
          )}
        </Dialog.Title>

        <Dialog.Description asChild>
          {tokenResponse ? (
            <div className="space-y-4">
              <Text className="text-text-secondary">
                <FormattedMessage
                  id="pages.personal_tokens.token_created_description"
                  defaultMessage="Your personal token has been created. Copy it now as it will not be shown again."
                  description="Description shown when a personal token is created"
                />
              </Text>

              <div className="flex items-center gap-2 p-3 bg-bg-subtle rounded border">
                <Text family="mono" size="sm" className="flex-1 break-all">
                  {tokenResponse.token}
                </Text>
                <CopyToClipboard value={tokenResponse.token} />
              </div>
            </div>
          ) : (
            <Form.Root onSubmit={handleSubmit}>
              <div className="space-y-4">
                <Form.Field name="human_name" serverInvalid={false}>
                  <Form.Label>
                    <FormattedMessage
                      id="pages.personal_tokens.name_label"
                      defaultMessage="Token name"
                      description="Label for the personal token name field"
                    />
                  </Form.Label>
                  <Form.TextControl
                    required
                    placeholder={intl.formatMessage({
                      id: "pages.personal_tokens.name_placeholder",
                      defaultMessage: "My application token",
                      description:
                        "Placeholder for the personal token name field",
                    })}
                  />
                </Form.Field>

                <Form.Field name="actor_user_id" serverInvalid={false}>
                  <Form.Label>
                    <FormattedMessage
                      id="pages.personal_tokens.actor_user_label"
                      defaultMessage="Acting user ID"
                      description="Label for the acting user ID field"
                    />
                  </Form.Label>
                  <Form.TextControl
                    required
                    placeholder={intl.formatMessage({
                      id: "pages.personal_tokens.actor_user_placeholder",
                      defaultMessage: "01234567890123456789012345",
                      description: "Placeholder for the acting user ID field",
                    })}
                  />
                  <Form.HelpMessage>
                    <FormattedMessage
                      id="pages.personal_tokens.actor_user_help"
                      defaultMessage="The ULID of the user this token will act on behalf of"
                      description="Help text for the acting user ID field"
                    />
                  </Form.HelpMessage>
                </Form.Field>

                <Form.Field name="scope" serverInvalid={false}>
                  <Form.Label>
                    <FormattedMessage
                      id="pages.personal_tokens.scope_label"
                      defaultMessage="Scopes"
                      description="Label for the scopes field"
                    />
                  </Form.Label>
                  <Form.TextControl
                    required
                    placeholder={intl.formatMessage({
                      id: "pages.personal_tokens.scope_placeholder",
                      defaultMessage: "openid profile",
                      description: "Placeholder for the scopes field",
                    })}
                  />
                  <Form.HelpMessage>
                    <FormattedMessage
                      id="pages.personal_tokens.scope_help"
                      defaultMessage="Space-separated list of OAuth2 scopes"
                      description="Help text for the scopes field"
                    />
                  </Form.HelpMessage>
                </Form.Field>

                <Form.Field name="expires_in_days" serverInvalid={false}>
                  <Form.Label>
                    <FormattedMessage
                      id="pages.personal_tokens.expires_in_label"
                      defaultMessage="Expires in (days)"
                      description="Label for the expiry field"
                    />
                  </Form.Label>
                  <Form.TextControl
                    type="number"
                    min="1"
                    placeholder={intl.formatMessage({
                      id: "pages.personal_tokens.expires_in_placeholder",
                      defaultMessage: "30",
                      description: "Placeholder for the expiry field",
                    })}
                  />
                  <Form.HelpMessage>
                    <FormattedMessage
                      id="pages.personal_tokens.expires_in_help"
                      defaultMessage="Leave empty for tokens that never expire"
                      description="Help text for the expiry field"
                    />
                  </Form.HelpMessage>
                </Form.Field>
              </div>

              <Form.Submit disabled={isSubmitting}>
                {isSubmitting && <InlineSpinner />}
                <FormattedMessage
                  id="pages.personal_tokens.create_token"
                  defaultMessage="Create token"
                  description="Button text to create a personal token"
                />
              </Form.Submit>
            </Form.Root>
          )}
        </Dialog.Description>

        <Dialog.Close asChild>
          <Button
            type="button"
            kind="tertiary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            <FormattedMessage {...messages.actionCancel} />
          </Button>
        </Dialog.Close>
      </Dialog.Root>
    </>
  );
};

const PersonalTokenCount = ({ serverName }: { serverName: string }) => {
  const { data } = useSuspenseQuery(personalSessionsCountQuery(serverName));

  return (
    <FormattedMessage
      id="pages.personal_tokens.count"
      defaultMessage="{count, plural, =0 {No personal tokens} one {# personal token} other {# personal tokens}}"
      description="Shows the number of personal tokens"
      values={{ count: data }}
    />
  );
};

const filtersDefinition = [
  {
    key: "status",
    value: "active",
    message: defineMessage({
      id: "pages.personal_tokens.filter.active",
      defaultMessage: "Active",
      description: "Filter label for active personal tokens",
    }),
  },
  {
    key: "status",
    value: "revoked",
    message: defineMessage({
      id: "pages.personal_tokens.filter.revoked",
      defaultMessage: "Revoked",
      description: "Filter label for revoked personal tokens",
    }),
  },
] as const;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const { parameters } = Route.useLoaderDeps();
  const from = useCurrentChildRoutePath(Route.id);
  const navigate = useNavigate({ from });
  const intl = useIntl();

  const { data, hasNextPage, fetchNextPage, isFetching } =
    useSuspenseInfiniteQuery(
      personalSessionsInfiniteQuery(credentials.serverName, parameters),
    );

  // Flatten the array of arrays from the useInfiniteQuery hook
  const flatData = useMemo(
    () => data?.pages?.flatMap((page) => page.data) ?? [],
    [data],
  );

  const filters = useFilters(search, filtersDefinition);

  // Column definitions
  const columns = useMemo<ColumnDef<SingleResourceForPersonalSession>[]>(
    () => [
      {
        id: "name",
        header: intl.formatMessage({
          id: "pages.personal_tokens.name_column",
          defaultMessage: "Name",
          description: "Column header for token name column",
        }),
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Link
              to="/personal-tokens/$tokenId"
              params={{ tokenId: token.id }}
              search={search}
              resetScroll={false}
            >
              <Text size="md" weight="semibold">
                {token.attributes.human_name}
              </Text>
            </Link>
          );
        },
      },
      {
        id: "actingUser",
        header: intl.formatMessage({
          id: "pages.personal_tokens.acting_user_column",
          defaultMessage: "Acting User",
          description: "Column header for acting user column",
        }),
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary font-mono">
              {token.attributes.actor_user_id}
            </Text>
          );
        },
      },
      {
        id: "scopes",
        header: intl.formatMessage({
          id: "pages.personal_tokens.scopes_column",
          defaultMessage: "Scopes",
          description: "Column header for scopes column",
        }),
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {token.attributes.scope}
            </Text>
          );
        },
      },
      {
        id: "createdAt",
        header: intl.formatMessage({
          id: "pages.personal_tokens.created_at_column",
          defaultMessage: "Created at",
          description: "Column header for created at column",
        }),
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
        id: "expiresAt",
        header: intl.formatMessage({
          id: "pages.personal_tokens.expires_at_column",
          defaultMessage: "Expires at",
          description: "Column header for expires at column",
        }),
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {token.attributes.expires_at
                ? computeHumanReadableDateTimeStringFromUtc(
                    token.attributes.expires_at,
                  )
                : intl.formatMessage({
                    id: "pages.personal_tokens.never_expires",
                    defaultMessage: "Never expires",
                    description:
                      "Text shown when a token has no expiration date",
                  })}
            </Text>
          );
        },
      },
      {
        id: "lastActive",
        header: intl.formatMessage({
          id: "pages.personal_tokens.last_active_column",
          defaultMessage: "Last Active",
          description: "Column header for last active column",
        }),
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {token.attributes.last_active_at
                ? computeHumanReadableDateTimeStringFromUtc(
                    token.attributes.last_active_at,
                  )
                : intl.formatMessage({
                    id: "pages.personal_tokens.never_used",
                    defaultMessage: "Never used",
                    description: "Text shown when a token has never been used",
                  })}
            </Text>
          );
        },
      },
      {
        id: "status",
        header: intl.formatMessage({
          id: "pages.personal_tokens.status.column",
          defaultMessage: "Status",
          description: "Column header for status column",
        }),
        cell: ({ row }) => {
          const token = row.original;
          return <PersonalTokenStatusBadge token={token.attributes} />;
        },
      },
    ],
    [search, intl],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- We pass things as a ref to avoid this problem
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
            <Page.Controls>
              <PersonalTokenAddButton serverName={credentials.serverName} />
            </Page.Controls>
          </Page.Header>

          <Table.Root>
            <Table.Header>
              <Table.DynamicTitle>
                <PersonalTokenCount serverName={credentials.serverName} />
              </Table.DynamicTitle>

              <Table.FilterMenu>
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
              </Table.FilterMenu>

              {filters.active.length > 0 && (
                <Table.ActiveFilterList>
                  {filters.active.map((filter) => (
                    <Table.ActiveFilter key={filter.key}>
                      <FormattedMessage {...filter.message} />
                      <Table.RemoveFilterLink
                        from={from}
                        replace={true}
                        search={filter.toggledState}
                      />
                    </Table.ActiveFilter>
                  ))}

                  <TextLink
                    from={from}
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
                  <FormattedMessage
                    id="pages.personal_tokens.loading_more"
                    defaultMessage="Loading more tokens..."
                    description="Text shown when loading more tokens"
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
