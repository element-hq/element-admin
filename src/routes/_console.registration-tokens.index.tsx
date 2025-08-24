/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, MatchRoute, createFileRoute } from "@tanstack/react-router";
import { PlusIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Badge, Button, Text } from "@vector-im/compound-web";
import { FormattedMessage } from "react-intl";
import * as v from "valibot";

import { type TokenListParameters, registrationTokensQuery } from "@/api/mas";
import { CopyToClipboard } from "@/components/copy";
import { ButtonLink, ChatFilterLink } from "@/components/link";
import * as Page from "@/components/page";
import * as Table from "@/components/table";
import { PAGE_SIZE } from "@/constants";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

const TokenSearchParameters = v.object({
  before: v.optional(v.string()),
  after: v.optional(v.string()),
  first: v.optional(v.number()),
  last: v.optional(v.number()),
  used: v.optional(v.boolean()),
  revoked: v.optional(v.boolean()),
  expired: v.optional(v.boolean()),
  valid: v.optional(v.boolean()),
});

export const Route = createFileRoute("/_console/registration-tokens/")({
  validateSearch: TokenSearchParameters,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials, intl },
    deps: { search },
  }) => {
    const parameters: TokenListParameters = {
      ...(search.before && { before: search.before }),
      ...(search.after && { after: search.after }),
      ...(search.first && { first: search.first }),
      ...(search.last && { last: search.last }),
      ...(search.used !== undefined && { used: search.used }),
      ...(search.revoked !== undefined && { revoked: search.revoked }),
      ...(search.expired !== undefined && { expired: search.expired }),
      ...(search.valid !== undefined && { valid: search.valid }),
    };

    await queryClient.ensureQueryData(
      registrationTokensQuery(credentials.serverName, parameters),
    );

    return {
      title: intl.formatMessage({
        id: "pages.registration_tokens.title",
        defaultMessage: "Registration tokens",
        description: "The title of the registration tokens list page",
      }),
    };
  },
  head: ({ loaderData }) => ({
    meta: [loaderData ? { title: loaderData.title } : {}],
  }),
  component: RouteComponent,
});

const resetPagination = ({
  before: _before,
  after: _after,
  first: _first,
  last: _last,
  ...search
}: v.InferOutput<typeof TokenSearchParameters>): v.InferOutput<
  typeof TokenSearchParameters
> => search;

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

  const parameters: TokenListParameters = {
    ...(search.before && { before: search.before }),
    ...(search.after && { after: search.after }),
    ...(search.first && { first: search.first }),
    ...(search.last && { last: search.last }),
    ...(search.used !== undefined && { used: search.used }),
    ...(search.revoked !== undefined && { revoked: search.revoked }),
    ...(search.expired !== undefined && { expired: search.expired }),
    ...(search.valid !== undefined && { valid: search.valid }),
  };

  const { data } = useSuspenseQuery(
    registrationTokensQuery(credentials.serverName, parameters),
  );

  const hasNext = !!data.links.next || search.before;
  const hasPrevious = !!data.links.prev || search.after;
  const lastId = data.data.at(-1)?.id;
  const firstId = data.data[0]?.id;

  const nextPageParameters = hasNext && {
    ...resetPagination(search),
    after: lastId || "",
    first: search.first || PAGE_SIZE,
  };

  const previousPageParameters = hasPrevious && {
    ...resetPagination(search),
    before: firstId || "",
    last: search.last || PAGE_SIZE,
  };

  const firstPageParameters = hasPrevious && {
    ...resetPagination(search),
    first: search.first || PAGE_SIZE,
  };

  const lastPageParameters = hasNext && {
    ...resetPagination(search),
    last: search.last || PAGE_SIZE,
  };

  return (
    <div className="flex flex-col gap-6">
      <Page.Header>
        <Page.Title>
          <FormattedMessage
            id="pages.registration_tokens.title"
            defaultMessage="Registration tokens"
            description="The title of the registration tokens list page"
          />
        </Page.Title>
        <Page.Controls>
          <Page.LinkButton
            to="/registration-tokens/add"
            variant="secondary"
            Icon={PlusIcon}
          >
            Add
          </Page.LinkButton>
        </Page.Controls>
      </Page.Header>

      {/* Filters */}
      <div className="flex gap-4">
        <ChatFilterLink
          selected={search.valid === true}
          to={Route.fullPath}
          search={
            search.valid === true
              ? omit(resetPagination(search), ["valid"])
              : {
                  ...resetPagination(search),
                  valid: true,
                }
          }
        >
          Active Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.used === true}
          to={Route.fullPath}
          search={
            search.used === true
              ? omit(resetPagination(search), ["used"])
              : {
                  ...resetPagination(search),
                  used: true,
                }
          }
        >
          Used Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.revoked === true}
          to={Route.fullPath}
          search={
            search.revoked === true
              ? omit(resetPagination(search), ["revoked"])
              : {
                  ...resetPagination(search),
                  revoked: true,
                }
          }
        >
          Revoked Only
        </ChatFilterLink>
        <ChatFilterLink
          selected={search.expired === true}
          to={Route.fullPath}
          search={
            search.expired === true
              ? omit(resetPagination(search), ["expired"])
              : {
                  ...resetPagination(search),
                  expired: true,
                }
          }
        >
          Expired Only
        </ChatFilterLink>
      </div>

      <Table.Root>
        <Table.Header>
          <Table.Title>{data.data.length.toLocaleString()} tokens</Table.Title>
          <Table.Controls>
            <Table.Showing>
              Showing {data.data.length} token
              {data.data.length === 1 ? "" : "s"}
            </Table.Showing>
            <Table.FilterButton />
          </Table.Controls>
        </Table.Header>

        <Table.List>
          <Table.ListHeader>
            <Table.ListHeaderCell>Token</Table.ListHeaderCell>
            <Table.ListHeaderCell>Created At</Table.ListHeaderCell>
            <Table.ListHeaderCell>Valid Until</Table.ListHeaderCell>
            <Table.ListHeaderCell>Uses</Table.ListHeaderCell>
            <Table.ListHeaderCell>Status</Table.ListHeaderCell>
          </Table.ListHeader>

          <Table.ListBody>
            {data.data.map((token) => (
              <Table.ListRow key={token.id} clickable>
                <Table.ListCell>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/registration-tokens/$tokenId"
                      params={{ tokenId: token.id }}
                      className="text-text-link-external hover:underline"
                    >
                      <Text weight="medium">{token.attributes.token}</Text>
                    </Link>
                    <CopyToClipboard value={token.attributes.token} />
                  </div>
                </Table.ListCell>
                <Table.ListCell>
                  {computeHumanReadableDateTimeStringFromUtc(
                    token.attributes.created_at,
                  )}
                </Table.ListCell>
                <Table.ListCell>
                  {token.attributes.expires_at
                    ? computeHumanReadableDateTimeStringFromUtc(
                        token.attributes.expires_at,
                      )
                    : "Never expires"}
                </Table.ListCell>
                <Table.ListCell>
                  {token.attributes.times_used} /{" "}
                  {token.attributes.usage_limit || "∞"}
                </Table.ListCell>
                <Table.ListCell>
                  <Badge kind={token.attributes.valid ? "green" : "red"}>
                    {getTokenStatus(token.attributes)}
                  </Badge>
                </Table.ListCell>
              </Table.ListRow>
            ))}
          </Table.ListBody>
        </Table.List>
      </Table.Root>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <MatchRoute to={Route.path} pending>
          {(match) => (
            <>
              <div className="flex gap-2">
                {firstPageParameters ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={firstPageParameters}
                  >
                    First
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    First
                  </Button>
                )}

                {previousPageParameters ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={previousPageParameters}
                  >
                    Previous
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    Previous
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {nextPageParameters ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={nextPageParameters}
                  >
                    Next
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    Next
                  </Button>
                )}

                {lastPageParameters ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={lastPageParameters}
                  >
                    Last
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    Last
                  </Button>
                )}
              </div>
            </>
          )}
        </MatchRoute>
      </div>
    </div>
  );
}

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
