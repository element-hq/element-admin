import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, MatchRoute, createFileRoute } from "@tanstack/react-router";
import { PlusIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Badge, Button, H2, Text } from "@vector-im/compound-web";
import * as v from "valibot";

import { type TokenListParams, registrationTokensQuery } from "@/api/mas";
import { CopyToClipboard } from "@/components/copy";
import { ButtonLink, ChatFilterLink } from "@/components/link";
import { PAGE_SIZE } from "@/constants";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

const TokenSearchParams = v.object({
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
  validateSearch: TokenSearchParams,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({
    context: { queryClient, credentials },
    deps: { search },
  }) => {
    const params: TokenListParams = {
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
      registrationTokensQuery(queryClient, credentials.serverName, params),
    );
  },
  component: RouteComponent,
});

const resetPagination = ({
  before: _before,
  after: _after,
  first: _first,
  last: _last,
  ...search
}: v.InferOutput<typeof TokenSearchParams>): v.InferOutput<
  typeof TokenSearchParams
> => search;

const omit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> =>
  Object.fromEntries(
    Object.entries(obj).filter(([key]) => !(keys as string[]).includes(key)),
  ) as Omit<T, K>;

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const params: TokenListParams = {
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
    registrationTokensQuery(queryClient, credentials.serverName, params),
  );

  const hasNext = !!data.links.next || search.before;
  const hasPrev = !!data.links.prev || search.after;
  const lastId = data.data[data.data.length - 1]?.id;
  const firstId = data.data[0]?.id;

  const nextPageParams = hasNext && {
    ...resetPagination(search),
    after: lastId || "",
    first: search.first || PAGE_SIZE,
  };

  const prevPageParams = hasPrev && {
    ...resetPagination(search),
    before: firstId || "",
    last: search.last || PAGE_SIZE,
  };

  const firstPageParams = hasPrev && {
    ...resetPagination(search),
    first: search.first || PAGE_SIZE,
  };

  const lastPageParams = hasNext && {
    ...resetPagination(search),
    last: search.last || PAGE_SIZE,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <H2 className="flex-1">Registration Tokens</H2>
        <ButtonLink
          to="/registration-tokens/add"
          kind="secondary"
          size="sm"
          Icon={PlusIcon}
        >
          Create New Token
        </ButtonLink>
        <Text size="sm" className="text-text-secondary">
          Total: {data.meta.count}
        </Text>
      </div>

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

      {/* Tokens Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border-interactive-secondary">
          <thead className="bg-bg-canvas-disabled">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Token
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Created At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Valid Until
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Uses
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-bg-canvas-default divide-y divide-border-interactive-secondary">
            {data.data.map((token) => (
              <tr
                key={token.id}
                className="hover:bg-bg-action-secondary-hovered"
              >
                <td className="px-6 py-4 whitespace-nowrap flex items-center gap-2">
                  <Link
                    to="/registration-tokens/$tokenId"
                    params={{ tokenId: token.id }}
                    className="text-text-link-external hover:underline"
                  >
                    <Text weight="medium">{token.attributes.token}</Text>
                  </Link>
                  <CopyToClipboard value={token.attributes.token} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {computeHumanReadableDateTimeStringFromUtc(
                    token.attributes.created_at,
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {token.attributes.expires_at
                    ? computeHumanReadableDateTimeStringFromUtc(
                        token.attributes.expires_at,
                      )
                    : "Never expires"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {token.attributes.times_used} /{" "}
                  {token.attributes.usage_limit || "∞"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge kind={token.attributes.valid ? "green" : "red"}>
                    {getTokenStatus(token.attributes)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <MatchRoute to={Route.path} pending>
          {(match) => (
            <>
              <div className="flex gap-2">
                {firstPageParams ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={firstPageParams}
                  >
                    First
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    First
                  </Button>
                )}

                {prevPageParams ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={prevPageParams}
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
                {nextPageParams ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={nextPageParams}
                  >
                    Next
                  </ButtonLink>
                ) : (
                  <Button kind="secondary" size="sm" disabled>
                    Next
                  </Button>
                )}

                {lastPageParams ? (
                  <ButtonLink
                    disabled={!!match}
                    from={Route.path}
                    kind="secondary"
                    size="sm"
                    search={lastPageParams}
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
  expires_at: string | null;
  usage_limit: number | null;
  times_used: number;
  revoked_at: string | null;
}) {
  if (!token.valid) {
    if (token.revoked_at) {
      return "Revoked";
    }
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return "Expired";
    }
    if (token.usage_limit !== null && token.times_used >= token.usage_limit) {
      return "Used Up";
    }
    return "Invalid";
  }
  return "Active";
}
