// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CloseIcon,
  RestartIcon,
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
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { FormattedMessage, useIntl } from "react-intl";

import {
  personalSessionQuery,
  regeneratePersonalSession,
  revokePersonalSession,
  userQuery,
} from "@/api/mas";
import type { SingleResourceForPersonalSession } from "@/api/mas/api";
import { CopyToClipboard } from "@/components/copy";
import * as Data from "@/components/data";
import * as Dialog from "@/components/dialog";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as messages from "@/messages";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

export const Route = createFileRoute("/_console/personal-tokens/$tokenId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    const { data: session } = await queryClient.ensureQueryData(
      personalSessionQuery(credentials.serverName, params.tokenId),
    );
    await queryClient.ensureQueryData(
      userQuery(credentials.serverName, session.attributes.actor_user_id),
    );
    if (session.attributes.owner_user_id) {
      await queryClient.ensureQueryData(
        userQuery(credentials.serverName, session.attributes.owner_user_id),
      );
    }
  },
  component: TokenDetailComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  const navigate = useNavigate();

  return (
    <Navigation.Details>
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        <Text size="lg" weight="semibold" className="text-text-secondary">
          <FormattedMessage
            id="pages.personal_tokens.not_found.title"
            defaultMessage="Personal token not found"
            description="Title shown when a personal token is not found"
          />
        </Text>
        <Text size="sm" className="text-text-secondary">
          <FormattedMessage
            id="pages.personal_tokens.not_found.description"
            defaultMessage="The personal token you're looking for doesn't exist or has been removed."
            description="Description shown when a personal token is not found"
          />
        </Text>
        <Button
          kind="secondary"
          size="sm"
          Icon={ArrowLeftIcon}
          onClick={() => navigate({ to: "/personal-tokens" })}
        >
          <FormattedMessage {...messages.actionGoBack} />
        </Button>
      </div>
    </Navigation.Details>
  );
}

const CloseSidebar = () => {
  const intl = useIntl();
  const search = Route.useSearch();
  return (
    <div className="flex items-center justify-end pb-4">
      <Tooltip label={intl.formatMessage(messages.actionClose)}>
        <ButtonLink
          iconOnly
          to="/personal-tokens"
          search={search}
          kind="tertiary"
          size="sm"
          Icon={CloseIcon}
        />
      </Tooltip>
    </div>
  );
};

const Scope = ({ scope }: { scope: string }) => {
  switch (scope) {
    case "urn:mas:admin": {
      return (
        <FormattedMessage
          id="pages.personal_tokens.scope_mas_admin_help"
          defaultMessage="Access to the MAS admin API"
          description="Help text for MAS admin scope"
        />
      );
    }
    case "urn:matrix:client:api:*": {
      return (
        <FormattedMessage
          id="pages.personal_tokens.scope_matrix_client_help"
          defaultMessage="Access to the Matrix Client-Server API"
          description="Help text for Matrix Client API scope"
        />
      );
    }
    case "urn:synapse:admin:*": {
      return (
        <FormattedMessage
          id="pages.personal_tokens.scope_synapse_admin_help"
          defaultMessage="Access to the Synapse admin API"
          description="Help text for Synapse admin scope"
        />
      );
    }
    default: {
      return scope;
    }
  }
};

function TokenDetailComponent() {
  const intl = useIntl();
  const { credentials } = Route.useRouteContext();
  const parameters = Route.useParams();
  const queryClient = useQueryClient();

  const {
    data: { data: token },
  } = useSuspenseQuery(
    personalSessionQuery(credentials.serverName, parameters.tokenId),
  );

  const {
    data: { data: actor },
  } = useSuspenseQuery(
    userQuery(credentials.serverName, token.attributes.actor_user_id),
  );

  const { data: ownerData } = useQuery({
    ...userQuery(credentials.serverName, token.attributes.owner_user_id || ""),
    enabled: !!token.attributes.owner_user_id,
  });

  const actorMxid = `@${actor.attributes.username}:${credentials.serverName}`;
  const ownerMxid = ownerData
    ? `@${ownerData.data.attributes.username}:${credentials.serverName}`
    : undefined;

  const revokeTokenMutation = useMutation({
    mutationFn: async () =>
      revokePersonalSession(
        queryClient,
        credentials.serverName,
        parameters.tokenId,
      ),
    onSuccess: (data) => {
      // Update the token query data
      queryClient.setQueryData(
        ["mas", "personal-session", credentials.serverName, parameters.tokenId],
        data,
      );

      // Invalidate tokens list query to reflect new data
      queryClient.invalidateQueries({
        queryKey: ["mas", "personal-sessions", credentials.serverName],
      });

      toast.success(
        intl.formatMessage({
          id: "pages.personal_tokens.revoke_success",
          defaultMessage: "Personal token revoked successfully",
          description: "Success message when a personal token is revoked",
        }),
      );
    },
  });

  const scope = token.attributes.scope.split(" ");

  return (
    <Navigation.Details>
      <CloseSidebar />

      <div className="flex flex-col gap-4">
        <H3 className="text-center">{token.attributes.human_name}</H3>

        <Data.Grid>
          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.personal_tokens.status.label"
                defaultMessage="Status"
                description="Label for the personal token status field"
              />
            </Data.Title>
            <Data.Value>
              <PersonalTokenStatusBadge token={token} />
            </Data.Value>
          </Data.Item>

          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.personal_tokens.acting_user_label"
                defaultMessage="Acting user"
                description="Label for the acting user field"
              />
            </Data.Title>
            <Data.Value>{actorMxid}</Data.Value>
          </Data.Item>

          {ownerData && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.personal_tokens.owner_user_label"
                  defaultMessage="Owner"
                  description="Label for the owner user field"
                />
              </Data.Title>
              <Data.Value>{ownerMxid}</Data.Value>
            </Data.Item>
          )}

          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.personal_tokens.scopes_label"
                defaultMessage="Scopes"
                description="Label for the scopes field"
              />
            </Data.Title>
            {scope.map((scope) => (
              <Data.Value key={scope}>
                <Scope scope={scope} />
              </Data.Value>
            ))}
          </Data.Item>

          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.personal_tokens.created_at_label"
                defaultMessage="Created at"
                description="Label for the token creation date field"
              />
            </Data.Title>
            <Data.Value>
              {computeHumanReadableDateTimeStringFromUtc(
                token.attributes.created_at,
              )}
            </Data.Value>
          </Data.Item>

          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.personal_tokens.expires_at_label"
                defaultMessage="Expires at"
                description="Label for the token expiration date field"
              />
            </Data.Title>
            <Data.Value>
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
            </Data.Value>
          </Data.Item>

          {token.attributes.last_active_at && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.personal_tokens.last_active_label"
                  defaultMessage="Last active"
                  description="Label for the last active date field"
                />
              </Data.Title>
              <Data.Value>
                {computeHumanReadableDateTimeStringFromUtc(
                  token.attributes.last_active_at,
                )}
              </Data.Value>
            </Data.Item>
          )}

          {token.attributes.last_active_ip && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.personal_tokens.last_active_ip_label"
                  defaultMessage="Last active IP"
                  description="Label for the last active IP field"
                />
              </Data.Title>
              <Data.Value>{token.attributes.last_active_ip}</Data.Value>
            </Data.Item>
          )}

          {token.attributes.revoked_at && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.personal_tokens.revoked_at_label"
                  defaultMessage="Revoked at"
                  description="Label for the token revocation date field"
                />
              </Data.Title>
              <Data.Value>
                {computeHumanReadableDateTimeStringFromUtc(
                  token.attributes.revoked_at,
                )}
              </Data.Value>
            </Data.Item>
          )}
        </Data.Grid>

        {!token.attributes.revoked_at && (
          <>
            <RegenerateTokenModal
              token={token}
              serverName={credentials.serverName}
            />

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
              <FormattedMessage
                id="pages.personal_tokens.revoke_token"
                defaultMessage="Revoke token"
                description="Button text to revoke a token"
              />
            </Button>
          </>
        )}
      </div>
    </Navigation.Details>
  );
}

interface PersonalTokenStatusBadgeProps {
  token: SingleResourceForPersonalSession;
}

function PersonalTokenStatusBadge({
  token,
}: PersonalTokenStatusBadgeProps): React.ReactElement {
  if (token.attributes.revoked_at) {
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

  if (token.attributes.expires_at) {
    const expiryDate = new Date(token.attributes.expires_at);
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

interface RegenerateTokenModalProps {
  token: SingleResourceForPersonalSession;
  serverName: string;
}

function RegenerateTokenModal({
  token,
  serverName,
}: RegenerateTokenModalProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const intl = useIntl();

  const regenerateTokenMutation = useMutation({
    mutationFn: async (expiresIn: null | number) =>
      regeneratePersonalSession(queryClient, serverName, token.id, {
        expires_in: expiresIn,
      }),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.personal_tokens.regenerate_error",
          defaultMessage: "Failed to regenerate personal token",
          description: "Error message when regenerating a personal token fails",
        }),
      );
    },
    onSuccess: (data) => {
      toast.success(
        intl.formatMessage({
          id: "pages.personal_tokens.regenerate_success",
          defaultMessage: "Personal token regenerated successfully",
          description: "Success message when a personal token is regenerated",
        }),
      );

      // Update the token query data
      queryClient.setQueryData(
        ["mas", "personal-session", serverName, token.id],
        data,
      );

      // Invalidate tokens list query to reflect new data
      queryClient.invalidateQueries({
        queryKey: ["mas", "personal-sessions", serverName],
      });
    },
  });

  const {
    mutate,
    isPending,
    data: mutationData,
    reset,
  } = regenerateTokenMutation;

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPending) {
        return;
      }

      const formData = new FormData(event.currentTarget);
      const expiresInDays = formData.get("expires_in_days") as string;

      const expiresIn =
        expiresInDays && expiresInDays !== ""
          ? Number.parseInt(expiresInDays, 10) * 24 * 60 * 60
          : null;

      mutate(expiresIn);
    },
    [mutate, isPending],
  );

  const handleClose = useCallback(() => {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    reset();
  }, [isPending, reset]);

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <Button
          type="button"
          size="sm"
          kind="secondary"
          Icon={RestartIcon}
          onClick={() => setIsOpen(true)}
        >
          <FormattedMessage
            id="pages.personal_tokens.regenerate_token"
            defaultMessage="Regenerate token"
            description="Button text to regenerate a token"
          />
        </Button>
      }
    >
      <Dialog.Title>
        {mutationData?.data.attributes.access_token ? (
          <FormattedMessage
            id="pages.personal_tokens.token_regenerated_title"
            defaultMessage="Token regenerated"
            description="Title of the dialog when a personal token is successfully regenerated"
          />
        ) : (
          <FormattedMessage
            id="pages.personal_tokens.regenerate_token_title"
            defaultMessage="Regenerate personal token"
            description="Title of the regenerate personal token dialog"
          />
        )}
      </Dialog.Title>

      <Dialog.Description asChild>
        {mutationData?.data.attributes.access_token ? (
          <div className="space-y-4">
            <Text className="text-text-secondary">
              <FormattedMessage
                id="pages.personal_tokens.token_regenerated_description"
                defaultMessage="Your personal token has been regenerated. Copy it now as it will not be shown again."
                description="Description shown when a personal token is regenerated"
              />
            </Text>

            <div className="flex gap-4 items-center">
              <Form.TextInput
                className="flex-1"
                readOnly
                value={mutationData?.data.attributes.access_token || ""}
              />
              <CopyToClipboard
                value={mutationData?.data.attributes.access_token || ""}
              />
            </div>
          </div>
        ) : (
          <Form.Root onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Text className="text-text-secondary">
                <FormattedMessage
                  id="pages.personal_tokens.regenerate_warning"
                  defaultMessage="This will generate a new access token and invalidate the current one. Any applications using the current token will need to be updated."
                  description="Warning message shown when regenerating a personal token"
                />
              </Text>

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
                    id="pages.personal_tokens.regenerate_expires_help"
                    defaultMessage="Leave empty to keep the same expiry as before, or set a new expiry time"
                    description="Help text for the expiry field when regenerating"
                  />
                </Form.HelpMessage>
              </Form.Field>
            </div>

            <Form.Submit
              disabled={isPending}
              Icon={isPending ? undefined : RestartIcon}
              kind="secondary"
              destructive
            >
              {isPending && <InlineSpinner />}
              <FormattedMessage
                id="pages.personal_tokens.regenerate_confirm"
                defaultMessage="Regenerate token"
                description="Button text to confirm regenerating a personal token"
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
          disabled={isPending}
        >
          <FormattedMessage {...messages.actionCancel} />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
  );
}
