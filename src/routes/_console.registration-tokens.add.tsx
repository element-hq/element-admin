import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CloseIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Button,
  Form,
  H2,
  H3,
  InlineSpinner,
  Text,
} from "@vector-im/compound-web";
import { type FormEvent, useCallback, useRef } from "react";

import { type CreateTokenParameters, createRegistrationToken } from "@/api/mas";
import { ButtonLink } from "@/components/link";
import { computeUtcIsoStringFromLocal } from "@/utils/datetime";

export const Route = createFileRoute("/_console/registration-tokens/add")({
  component: AddTokenComponent,
});

function AddTokenComponent() {
  const { credentials } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const customTokenInputRef = useRef<HTMLInputElement>(null);
  const usageLimitInputRef = useRef<HTMLInputElement>(null);
  const expiresInputRef = useRef<HTMLInputElement>(null);

  const createTokenMutation = useMutation({
    mutationFn: async (parameters: CreateTokenParameters) =>
      createRegistrationToken(queryClient, credentials.serverName, parameters),
    onSuccess: async (data): Promise<void> => {
      const tokenId = data.data.id;
      // Invalidate tokens list query to reflect new data
      await queryClient.invalidateQueries({
        queryKey: ["mas", "registration-tokens", credentials.serverName],
      });

      // Navigate back to tokens list
      await navigate({
        to: "/registration-tokens/$tokenId",
        params: { tokenId },
      });
    },
  });

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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

    createTokenMutation.mutate(parameters);
  };

  return (
    <div className="space-y-6">
      <ButtonLink to="/registration-tokens" kind="tertiary" size="sm">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Tokens
      </ButtonLink>

      <H2>Create Registration Token</H2>

      <div className="bg-bg-subtle-secondary rounded-lg">
        <div className="px-6 py-5 border-b border-border-interactive-secondary">
          <H3>Token Configuration</H3>
          <Text size="sm" className="text-text-secondary">
            Configure your new registration token
          </Text>
        </div>

        <div className="px-6 py-5">
          <Form.Root onSubmit={handleSubmit} className="space-y-6">
            <Form.Field name="customToken">
              <Form.Label>Custom Token</Form.Label>
              <div className="flex items-center gap-3">
                <Form.TextControl
                  type="text"
                  ref={customTokenInputRef}
                  className="flex-1"
                  placeholder="Auto-generate if left empty"
                />
                <Button
                  type="button"
                  iconOnly
                  kind="secondary"
                  onClick={clearCustomToken}
                  Icon={CloseIcon}
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
                />
                <Button
                  type="button"
                  iconOnly
                  kind="secondary"
                  onClick={clearUsageLimit}
                  Icon={CloseIcon}
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
                />
                <Button
                  type="button"
                  iconOnly
                  kind="secondary"
                  onClick={clearExpiration}
                  Icon={CloseIcon}
                />
              </div>
              <Form.HelpMessage>
                When the token expires. Leave empty if the token should never
                expire.
              </Form.HelpMessage>
            </Form.Field>

            <Button
              type="submit"
              kind="primary"
              disabled={createTokenMutation.isPending}
            >
              {createTokenMutation.isPending && (
                <InlineSpinner className="mr-2" />
              )}
              Create Token
            </Button>
          </Form.Root>
        </div>
      </div>
    </div>
  );
}
