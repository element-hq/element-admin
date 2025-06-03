import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Badge,
  Button,
  H3,
  InlineSpinner,
  Text,
} from "@vector-im/compound-web";

import { registrationTokenQuery, revokeRegistrationToken } from "@/api/mas";
import { CopyToClipboard } from "@/components/copy";
import { ButtonLink } from "@/components/link";

export const Route = createFileRoute("/_console/registration-tokens/$tokenId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    await queryClient.ensureQueryData(
      registrationTokenQuery(
        queryClient,
        credentials.serverName,
        params.tokenId,
      ),
    );
  },
  component: TokenDetailComponent,
});

function TokenDetailComponent() {
  const { credentials } = Route.useRouteContext();
  const params = Route.useParams();
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    registrationTokenQuery(queryClient, credentials.serverName, params.tokenId),
  );

  const revokeTokenMutation = useMutation({
    mutationFn: async () =>
      revokeRegistrationToken(
        queryClient,
        credentials.serverName,
        params.tokenId,
      ),
    onSuccess: (data) => {
      // Update the token query data
      queryClient.setQueryData(
        ["mas", "registration-token", credentials.serverName, params.tokenId],
        data,
      );

      // Invalidate tokens list query to reflect new data
      queryClient.invalidateQueries({
        queryKey: ["mas", "registration-tokens", credentials.serverName],
      });
    },
  });

  const token = data.data;
  const tokenAttributes = token.attributes;

  const copyMutation = useMutation({
    mutationFn: () => navigator.clipboard.writeText(tokenAttributes.token),
    onSuccess: () => setTimeout(() => copyMutation.reset(), 2000),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ButtonLink to="/registration-tokens" kind="tertiary" size="sm">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Tokens
        </ButtonLink>
      </div>

      <div className="bg-bg-subtle-secondary rounded-lg">
        <div className="px-6 py-5 border-b border-border-interactive-secondary">
          <H3 className="flex items-center gap-2">
            {tokenAttributes.token}

            <CopyToClipboard value={tokenAttributes.token} />
          </H3>

          <Text size="sm" className="text-text-secondary">
            Token ID: {token.id}
          </Text>
        </div>
        <div className="px-6 py-5 space-y-6">
          <div className="flex flex-col space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Text
                  size="sm"
                  weight="semibold"
                  className="text-text-secondary"
                >
                  Status
                </Text>
                <Badge kind={tokenAttributes.valid ? "green" : "red"}>
                  {getTokenStatus(tokenAttributes)}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Text
                  size="sm"
                  weight="semibold"
                  className="text-text-secondary"
                >
                  Created At
                </Text>
                <Text>
                  {new Date(tokenAttributes.created_at).toLocaleString()}
                </Text>
              </div>

              <div className="space-y-2">
                <Text
                  size="sm"
                  weight="semibold"
                  className="text-text-secondary"
                >
                  Expires At
                </Text>
                <Text>
                  {tokenAttributes.expires_at
                    ? new Date(tokenAttributes.expires_at).toLocaleString()
                    : "Never expires"}
                </Text>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Text
                  size="sm"
                  weight="semibold"
                  className="text-text-secondary"
                >
                  Usage Count
                </Text>
                <Text>
                  {tokenAttributes.times_used} /{" "}
                  {tokenAttributes.usage_limit || "∞"}
                </Text>
              </div>

              {tokenAttributes.revoked_at && (
                <div className="space-y-2">
                  <Text
                    size="sm"
                    weight="semibold"
                    className="text-text-secondary"
                  >
                    Revoked At
                  </Text>
                  <Text>
                    {new Date(tokenAttributes.revoked_at).toLocaleString()}
                  </Text>
                </div>
              )}
            </div>
          </div>

          <div className="pt-5 border-t border-border-interactive-secondary">
            <Text
              size="sm"
              weight="medium"
              className="text-text-secondary mb-4"
            >
              Actions
            </Text>
            <div className="flex gap-3">
              <Button
                size="sm"
                kind="secondary"
                destructive
                disabled={
                  revokeTokenMutation.isPending || !!tokenAttributes.revoked_at
                }
                onClick={() => revokeTokenMutation.mutate()}
              >
                {revokeTokenMutation.isPending && (
                  <InlineSpinner className="mr-2" />
                )}
                Revoke Token
              </Button>
            </div>
          </div>
        </div>
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
