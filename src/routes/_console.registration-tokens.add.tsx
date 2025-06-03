import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button, Form, H2, InlineSpinner, Text } from "@vector-im/compound-web";
import type { FormEvent } from "react";

import { type CreateTokenParams, createRegistrationToken } from "@/api/mas";
import { ButtonLink } from "@/components/link";

export const Route = createFileRoute("/_console/registration-tokens/add")({
  component: AddTokenComponent,
});

function AddTokenComponent() {
  const { credentials } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const createTokenMutation = useMutation({
    mutationFn: async (params: CreateTokenParams) =>
      createRegistrationToken(queryClient, credentials.serverName, params),
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const params: CreateTokenParams = {};

    const customTokenValue = formData.get("customToken") as string;
    if (customTokenValue && customTokenValue.trim() !== "") {
      params.token = customTokenValue.trim();
    }

    const usageLimitValue = formData.get("usageLimit") as string;
    if (usageLimitValue && !Number.isNaN(Number(usageLimitValue))) {
      params.usage_limit = Number(usageLimitValue);
    }

    createTokenMutation.mutate(params);
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
          <Text as="h3" size="md" weight="semibold">
            Token Configuration
          </Text>
          <Text size="sm" className="text-text-secondary">
            Configure your new registration token
          </Text>
        </div>

        <div className="px-6 py-5">
          <Form.Root onSubmit={handleSubmit}>
            <Form.Field name="customToken">
              <div className="flex justify-between">
                <Form.Label>Custom Token (Optional)</Form.Label>
              </div>
              <Form.TextControl
                type="text"
                placeholder="Auto-generate if left empty"
              />
              <Form.HelpMessage>
                Optional custom token string. If left empty, a secure token will
                be auto-generated.
              </Form.HelpMessage>
            </Form.Field>

            <Form.Field name="usageLimit">
              <div className="flex justify-between">
                <Form.Label>Usage Limit</Form.Label>
              </div>
              <Form.TextControl
                type="number"
                placeholder="Leave empty for unlimited uses"
                min="1"
              />
              <Form.HelpMessage>
                Maximum number of times this token can be used. Leave empty for
                unlimited uses.
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
