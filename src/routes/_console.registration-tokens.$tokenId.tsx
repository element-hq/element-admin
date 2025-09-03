/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CloseIcon,
  EditIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Badge,
  Button,
  Form,
  H3,
  InlineSpinner,
  Text,
  Tooltip,
} from "@vector-im/compound-web";
import { type FormEvent, useCallback, useRef, useState } from "react";
import { useIntl } from "react-intl";

import {
  type EditTokenParameters,
  editRegistrationToken,
  registrationTokenQuery,
  revokeRegistrationToken,
  unrevokeRegistrationToken,
} from "@/api/mas";
import { CopyToClipboard } from "@/components/copy";
import * as Dialog from "@/components/dialog";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import {
  computeHumanReadableDateTimeStringFromUtc,
  computeLocalDateTimeStringFromUtc,
  computeUtcIsoStringFromLocal,
} from "@/utils/datetime";

export const Route = createFileRoute("/_console/registration-tokens/$tokenId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    await queryClient.ensureQueryData(
      registrationTokenQuery(credentials.serverName, params.tokenId),
    );
  },
  component: TokenDetailComponent,
});

function TokenDetailComponent() {
  const intl = useIntl();
  const { credentials } = Route.useRouteContext();
  const parameters = Route.useParams();
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    registrationTokenQuery(credentials.serverName, parameters.tokenId),
  );

  const revokeTokenMutation = useMutation({
    mutationFn: async () =>
      revokeRegistrationToken(
        queryClient,
        credentials.serverName,
        parameters.tokenId,
      ),
    onSuccess: (data) => {
      // Update the token query data
      queryClient.setQueryData(
        [
          "mas",
          "registration-token",
          credentials.serverName,
          parameters.tokenId,
        ],
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
        parameters.tokenId,
      ),
    onSuccess: (data) => {
      // Update the token query data
      queryClient.setQueryData(
        [
          "mas",
          "registration-token",
          credentials.serverName,
          parameters.tokenId,
        ],
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
    <Navigation.Details>
      <div className="flex items-center justify-end">
        <Tooltip
          label={intl.formatMessage({
            id: "action.close",
            defaultMessage: "Close",
            description: "Label for a 'close' action/button",
          })}
        >
          <ButtonLink
            iconOnly
            to="/registration-tokens"
            kind="tertiary"
            size="sm"
            Icon={CloseIcon}
          />
        </Tooltip>
      </div>

      <div className="flex flex-col gap-4">
        <H3 className="flex items-center gap-2">
          {tokenAttributes.token}

          <CopyToClipboard value={tokenAttributes.token} />
        </H3>

        <div className="flex flex-wrap gap-4 *:flex *:flex-col *:gap-1 *:items-start">
          <div>
            <Text size="sm" weight="semibold" className="text-text-secondary">
              Status
            </Text>
            <Badge kind={tokenAttributes.valid ? "green" : "red"}>
              {getTokenStatus(tokenAttributes)}
            </Badge>
          </div>

          <div>
            <Text size="sm" weight="semibold" className="text-text-secondary">
              Created At
            </Text>
            <Text>
              {computeHumanReadableDateTimeStringFromUtc(
                tokenAttributes.created_at,
              )}
            </Text>
          </div>

          <div>
            <Text size="sm" weight="semibold" className="text-text-secondary">
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
          <div>
            <Text size="sm" weight="semibold" className="text-text-secondary">
              Usage Count
            </Text>
            <Text>
              {tokenAttributes.times_used} /{" "}
              {tokenAttributes.usage_limit || "∞"}
            </Text>
          </div>

          {tokenAttributes.revoked_at && (
            <div>
              <Text size="sm" weight="semibold" className="text-text-secondary">
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

        <div className="flex flex-col gap-3">
          {tokenAttributes.revoked_at ? (
            <Button
              type="button"
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
              type="button"
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

          <EditTokenModal
            token={token}
            serverName={credentials.serverName}
            tokenId={parameters.tokenId}
          />
        </div>
      </div>
    </Navigation.Details>
  );
}

interface EditTokenModalProps {
  token: {
    id: string;
    attributes: {
      token: string;
      expires_at?: string | null;
      usage_limit?: number | null;
      revoked_at?: string | null;
    };
  };
  serverName: string;
  tokenId: string;
}

function EditTokenModal({ token, serverName, tokenId }: EditTokenModalProps) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const expiresInputRef = useRef<HTMLInputElement>(null);
  const usageLimitInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const editTokenMutation = useMutation({
    mutationFn: async (parameters: EditTokenParameters) =>
      editRegistrationToken(queryClient, serverName, token.id, parameters),
    onSuccess: (data) => {
      // Update the token query data
      queryClient.setQueryData(
        ["mas", "registration-token", serverName, tokenId],
        data,
      );

      // Invalidate tokens list query to reflect new data
      queryClient.invalidateQueries({
        queryKey: ["mas", "registration-tokens", serverName],
      });

      // Close the modal and reset form
      setOpen(false);
      formRef.current?.reset();
    },
  });

  const { mutate: mutateEditToken, isPending } = editTokenMutation;
  const tokenAttributes = token.attributes;

  const clearExpiration = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (expiresInputRef.current) {
        expiresInputRef.current.value = "";
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

  const handleEditSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const formData = new FormData(event.currentTarget);
      const editParameters: EditTokenParameters = {};

      const expires = formData.get("expires") as string;
      editParameters.expires_at = expires
        ? computeUtcIsoStringFromLocal(expires)
        : // Empty string means set to null (never expires)
          null;

      const usageLimitValue = formData.get("usageLimit") as string;
      editParameters.usage_limit =
        usageLimitValue &&
        !Number.isNaN(Number(usageLimitValue)) &&
        Number(usageLimitValue) > 0
          ? Number(usageLimitValue)
          : null;

      mutateEditToken(editParameters);
    },
    [mutateEditToken],
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <Button
          type="button"
          size="sm"
          kind="secondary"
          disabled={!!tokenAttributes.revoked_at}
          Icon={EditIcon}
        >
          Edit Properties
        </Button>
      }
    >
      <Dialog.Title>Edit Registration Token</Dialog.Title>

      <Dialog.Description asChild>
        <Form.Root
          ref={formRef}
          onSubmit={handleEditSubmit}
          className="space-y-6"
        >
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

          <Form.Submit disabled={isPending}>
            {isPending && <InlineSpinner />}
            Save Changes
          </Form.Submit>
        </Form.Root>
      </Dialog.Description>

      <Dialog.Close asChild>
        <Button type="button" kind="tertiary" disabled={isPending}>
          Cancel
        </Button>
      </Dialog.Close>
    </Dialog.Root>
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
