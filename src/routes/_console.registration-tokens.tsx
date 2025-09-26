// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
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
import { useCallback, useMemo, useRef, useState } from "react";
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
import { TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import * as Table from "@/components/table";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import {
  computeHumanReadableDateTimeStringFromUtc,
  computeUtcIsoStringFromLocal,
} from "@/utils/datetime";
import { useFilters } from "@/utils/filters";

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
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  validateSearch: TokenSearchParameters,

  loaderDeps: ({ search }) => ({
    parameters: {
      ...(search.used !== undefined && { used: search.used }),
      ...(search.revoked !== undefined && { revoked: search.revoked }),
      ...(search.expired !== undefined && { expired: search.expired }),
      ...(search.valid !== undefined && { valid: search.valid }),
    } satisfies TokenListParameters,
  }),
  loader: async ({
    context: { queryClient, credentials },
    deps: { parameters },
  }) => {
    await queryClient.ensureInfiniteQueryData(
      registrationTokensInfiniteQuery(credentials.serverName, parameters),
    );
  },

  pendingComponent: () => (
    <>
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

      <Outlet />
    </>
  ),

  component: RouteComponent,
});

interface TokenStatusBadgeProps {
  token: {
    valid: boolean;
    expires_at?: string | null;
    usage_limit?: number | null;
    times_used: number;
    revoked_at?: string | null;
  };
}

function TokenStatusBadge({ token }: TokenStatusBadgeProps) {
  if (token.valid) {
    return (
      <Badge kind="green">
        <FormattedMessage
          id="pages.registration_tokens.status.active"
          defaultMessage="Active"
          description="Registration token status: active"
        />
      </Badge>
    );
  }

  if (token.revoked_at) {
    return (
      <Badge kind="red">
        <FormattedMessage
          id="pages.registration_tokens.status.revoked"
          defaultMessage="Revoked"
          description="Registration token status: revoked"
        />
      </Badge>
    );
  }

  if (token.expires_at && new Date(token.expires_at) < new Date()) {
    return (
      <Badge kind="red">
        <FormattedMessage
          id="pages.registration_tokens.status.expired"
          defaultMessage="Expired"
          description="Registration token status: expired"
        />
      </Badge>
    );
  }

  if (
    token.usage_limit !== null &&
    token.usage_limit !== undefined &&
    token.times_used >= token.usage_limit
  ) {
    return (
      <Badge kind="red">
        <FormattedMessage
          id="pages.registration_tokens.status.used_up"
          defaultMessage="Used up"
          description="Registration token status: used up"
        />
      </Badge>
    );
  }

  return (
    <Badge kind="red">
      <FormattedMessage
        id="pages.registration_tokens.status.invalid"
        defaultMessage="Invalid"
        description="Registration token status: invalid"
      />
    </Badge>
  );
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
          <FormattedMessage {...messages.actionAdd} />
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
            <Form.Label>
              <FormattedMessage
                id="pages.registration_tokens.custom_token_label"
                defaultMessage="Custom Token"
                description="Label for the custom token field"
              />
            </Form.Label>
            <div className="flex items-center gap-3">
              <Form.TextControl
                type="text"
                ref={customTokenInputRef}
                className="flex-1"
                placeholder={intl.formatMessage({
                  id: "pages.registration_tokens.auto_generate_placeholder",
                  defaultMessage: "Auto-generate if left empty",
                  description: "Placeholder text for custom token field",
                })}
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
              <FormattedMessage
                id="pages.registration_tokens.custom_token_help"
                defaultMessage="Optional custom token string. If left empty, a secure token will be auto-generated."
                description="Help text for the custom token field"
              />
            </Form.HelpMessage>
          </Form.Field>

          <Form.Field name="usageLimit">
            <Form.Label>
              <FormattedMessage
                id="pages.registration_tokens.usage_limit_label"
                defaultMessage="Usage Limit"
                description="Label for the usage limit field"
              />
            </Form.Label>
            <div className="flex items-center gap-3">
              <Form.TextControl
                type="number"
                ref={usageLimitInputRef}
                className="flex-1"
                placeholder={intl.formatMessage({
                  id: "pages.registration_tokens.unlimited_uses_placeholder",
                  defaultMessage: "Leave empty for unlimited uses",
                  description: "Placeholder text for usage limit field",
                })}
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
              <FormattedMessage
                id="pages.registration_tokens.usage_limit_help"
                defaultMessage="Maximum number of times this token can be used. Leave empty for unlimited uses."
                description="Help text for the usage limit field"
              />
            </Form.HelpMessage>
          </Form.Field>

          <Form.Field name="expires">
            <Form.Label>
              <FormattedMessage
                id="pages.registration_tokens.expires_at_label"
                defaultMessage="Expires at"
                description="Label for the token expiration date field"
              />
            </Form.Label>
            <div className="flex items-center gap-3">
              <Form.TextControl
                type="datetime-local"
                ref={expiresInputRef}
                className="flex-1"
                placeholder={intl.formatMessage({
                  id: "pages.registration_tokens.no_expiration_placeholder",
                  defaultMessage: "No expiration",
                  description: "Placeholder text for the expires at field",
                })}
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
              <FormattedMessage
                id="pages.registration_tokens.expires_at_help"
                defaultMessage="When the token expires. Leave empty if the token should never expire."
                description="Help text for the expires at field"
              />
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
          <FormattedMessage {...messages.actionCancel} />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
  );
};

const filtersDefinition = [
  {
    key: "valid",
    value: true,
    message: defineMessage({
      id: "pages.registration_tokens.filters.active_only",
      defaultMessage: "Active",
      description: "Filter option for active registration tokens only",
    }),
  },
  {
    key: "used",
    value: true,
    message: defineMessage({
      id: "pages.registration_tokens.filters.used_only",
      defaultMessage: "Used",
      description: "Filter option for used registration tokens only",
    }),
  },
  {
    key: "used",
    value: false,
    message: defineMessage({
      id: "pages.registration_tokens.filters.unused_only",
      defaultMessage: "Unused",
      description: "Filter option for unused registration tokens only",
    }),
  },
  {
    key: "revoked",
    value: true,
    message: defineMessage({
      id: "pages.registration_tokens.filters.revoked_only",
      defaultMessage: "Revoked",
      description: "Filter option for revoked registration tokens only",
    }),
  },
  {
    key: "expired",
    value: true,
    message: defineMessage({
      id: "pages.registration_tokens.filters.expired_only",
      defaultMessage: "Expired ",
      description: "Filter option for expired registration tokens only",
    }),
  },
] as const;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const { parameters } = Route.useLoaderDeps();
  const navigate = Route.useNavigate();
  const intl = useIntl();

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

  const filters = useFilters(search, filtersDefinition);

  // Column definitions
  const columns = useMemo<ColumnDef<SingleResourceForUserRegistrationToken>[]>(
    () => [
      {
        id: "token",
        header: intl.formatMessage({
          id: "pages.registration_tokens.token_column",
          defaultMessage: "Token",
          description: "Column header for token column",
        }),
        cell: ({ row }) => {
          const token = row.original;
          return (
            <div className="flex items-center gap-2">
              <Link
                to="/registration-tokens/$tokenId"
                params={{ tokenId: token.id }}
                search={search}
                resetScroll={false}
              >
                <Text size="md" weight="semibold">
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
        header: intl.formatMessage({
          id: "pages.registration_tokens.created_at_column",
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
        id: "validUntil",
        header: intl.formatMessage({
          id: "pages.registration_tokens.valid_until_column",
          defaultMessage: "Valid Until",
          description: "Column header for valid until column",
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
                    id: "pages.registration_tokens.never_expires",
                    defaultMessage: "Never expires",
                    description:
                      "Text shown when a token has no expiration date",
                  })}
            </Text>
          );
        },
      },
      {
        id: "uses",
        header: intl.formatMessage({
          id: "pages.registration_tokens.uses_column",
          defaultMessage: "Uses",
          description: "Column header for uses column",
        }),
        cell: ({ row }) => {
          const token = row.original;
          return (
            <Text size="sm" className="text-text-secondary">
              {token.attributes.usage_limit === null ? (
                <FormattedMessage
                  id="pages.registration_tokens.token_uses.unlimited"
                  defaultMessage="{uses, number} / ∞"
                  description="Shows the number of uses of a registration token, when there is no usage limit"
                  values={{
                    uses: token.attributes.times_used,
                  }}
                />
              ) : (
                <FormattedMessage
                  id="pages.registration_tokens.token_uses.limited"
                  defaultMessage="{uses, number} / {limit, number}"
                  description="Shows the number of uses of a registration token, when there is a usage limit"
                  values={{
                    uses: token.attributes.times_used,
                    limit: token.attributes.usage_limit,
                  }}
                />
              )}
            </Text>
          );
        },
      },
      {
        id: "status",
        header: intl.formatMessage({
          id: "pages.registration_tokens.status.column",
          defaultMessage: "Status",
          description: "Column header for status column",
        }),
        cell: ({ row }) => {
          const token = row.original;
          return <TokenStatusBadge token={token.attributes} />;
        },
      },
    ],
    [search, intl],
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
                  <FormattedMessage
                    id="pages.registration_tokens.loading_more"
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

      <Outlet />
    </>
  );
}
