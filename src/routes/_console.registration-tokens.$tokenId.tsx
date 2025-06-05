import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CloseIcon,
  EditIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Badge,
  Button,
  Form,
  H3,
  H6,
  InlineSpinner,
  Text,
} from "@vector-im/compound-web";
import { type FormEvent, useCallback, useRef, useState } from "react";

import {
  type EditTokenParams,
  editRegistrationToken,
  registrationTokenQuery,
  revokeRegistrationToken,
  unrevokeRegistrationToken,
} from "@/api/mas";
import { CopyToClipboard } from "@/components/copy";
import { ButtonLink } from "@/components/link";
import {
  computeHumanReadableDateTimeStringFromUtc,
  computeLocalDateTimeStringFromUtc,
  computeUtcIsoStringFromLocal,
} from "@/utils/datetime";

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

  const [isEditing, setIsEditing] = useState(false);

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

  const unrevokeTokenMutation = useMutation({
    mutationFn: async () =>
      unrevokeRegistrationToken(
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

  const editTokenMutation = useMutation({
    mutationFn: async (params: EditTokenParams) =>
      editRegistrationToken(
        queryClient,
        credentials.serverName,
        token.id,
        params,
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

      // Exit edit mode
      setIsEditing(false);
    },
  });

  const token = data.data;
  const tokenAttributes = token.attributes;

  const expiresInputRef = useRef<HTMLInputElement>(null);
  const usageLimitInputRef = useRef<HTMLInputElement>(null);

  const clearExpiration = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (expiresInputRef.current) {
        expiresInputRef.current.value = "";
      }
    },
    [],
  );

  const clearUsageLimit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (usageLimitInputRef.current) {
        usageLimitInputRef.current.value = "";
      }
    },
    [],
  );

  const copyMutation = useMutation({
    mutationFn: () => navigator.clipboard.writeText(tokenAttributes.token),
    onSuccess: () => setTimeout(() => copyMutation.reset(), 2000),
  });

  const handleEditSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      const formData = new FormData(e.currentTarget);
      const params: EditTokenParams = {};

      const expires = formData.get("expires") as string;
      if (expires) {
        params.expires_at = computeUtcIsoStringFromLocal(expires);
      } else {
        // Empty string means set to null (never expires)
        params.expires_at = null;
      }

      const usageLimitValue = formData.get("usageLimit") as string;
      if (
        usageLimitValue &&
        !Number.isNaN(Number(usageLimitValue)) &&
        Number(usageLimitValue) > 0
      ) {
        params.usage_limit = Number(usageLimitValue);
      } else {
        params.usage_limit = null;
      }

      editTokenMutation.mutate(params);
    },
    [editTokenMutation.mutate],
  );

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

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
                  {computeHumanReadableDateTimeStringFromUtc(
                    tokenAttributes.created_at,
                  )}
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
                    ? computeHumanReadableDateTimeStringFromUtc(
                        tokenAttributes.expires_at,
                      )
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
                    {computeHumanReadableDateTimeStringFromUtc(
                      tokenAttributes.revoked_at,
                    )}
                  </Text>
                </div>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="pt-5 border-t border-border-interactive-secondary">
              <Text
                size="sm"
                weight="medium"
                className="text-text-secondary mb-4"
              >
                Edit Token
              </Text>
              <Form.Root onSubmit={handleEditSubmit} className="space-y-6">
                <Form.Field name="expires">
                  <Form.Label>Expires at</Form.Label>
                  <div className="flex items-center gap-3">
                    <Form.TextControl
                      type="datetime-local"
                      ref={expiresInputRef}
                      className="flex-1"
                      defaultValue={
                        tokenAttributes.expires_at
                          ? computeLocalDateTimeStringFromUtc(
                              tokenAttributes.expires_at,
                            )
                          : ""
                      }
                      placeholder="No expiration"
                      min="1"
                    />
                    <Button
                      iconOnly
                      kind="secondary"
                      onClick={clearExpiration}
                      Icon={CloseIcon}
                    />
                  </div>
                  <Form.HelpMessage>
                    When the token expires. Leave empty if the token should
                    never expire.
                  </Form.HelpMessage>
                </Form.Field>

                <Form.Field name="usageLimit">
                  <Form.Label>Usage Limit</Form.Label>
                  <div className="flex items-center gap-3">
                    <Form.TextControl
                      type="number"
                      ref={usageLimitInputRef}
                      className="flex-1"
                      defaultValue={tokenAttributes.usage_limit || ""}
                      placeholder="Unlimited"
                      min="1"
                    />
                    <Button
                      iconOnly
                      kind="secondary"
                      onClick={clearUsageLimit}
                      Icon={CloseIcon}
                    />
                  </div>
                  <Form.HelpMessage>
                    Maximum number of times this token can be used. Leave empty
                    for unlimited uses.
                  </Form.HelpMessage>
                </Form.Field>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    kind="primary"
                    disabled={editTokenMutation.isPending}
                  >
                    {editTokenMutation.isPending && (
                      <InlineSpinner className="mr-2" />
                    )}
                    Save Changes
                  </Button>
                  <Button
                    type="button"
                    kind="secondary"
                    onClick={cancelEdit}
                    disabled={editTokenMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </Form.Root>
            </div>
          ) : (
            <div className="pt-5 border-t border-border-interactive-secondary flex flex-col gap-3">
              <H6>Actions</H6>
              <div className="flex gap-3">
                {tokenAttributes.revoked_at ? (
                  <Button
                    size="sm"
                    kind="secondary"
                    disabled={unrevokeTokenMutation.isPending}
                    onClick={() => unrevokeTokenMutation.mutate()}
                  >
                    {unrevokeTokenMutation.isPending && (
                      <InlineSpinner className="mr-2" />
                    )}
                    Unrevoke Token
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    kind="secondary"
                    destructive
                    disabled={revokeTokenMutation.isPending}
                    onClick={() => revokeTokenMutation.mutate()}
                  >
                    {revokeTokenMutation.isPending && (
                      <InlineSpinner className="mr-2" />
                    )}
                    Revoke Token
                  </Button>
                )}

                <Button
                  size="sm"
                  kind="secondary"
                  onClick={() => setIsEditing(true)}
                  disabled={!!tokenAttributes.revoked_at}
                  Icon={EditIcon}
                >
                  Edit Properties
                </Button>
              </div>
            </div>
          )}
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
