// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DeleteIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Alert,
  Button,
  Form,
  InlineSpinner,
  Text,
  Tooltip,
} from "@vector-im/compound-web";
import { useRef } from "react";
import { toast } from "react-hot-toast";
import { FormattedMessage, useIntl } from "react-intl";

import { essVersionQuery, useEssVariant } from "@/api/ess";
import {
  addToAllowlist,
  federationAllowlistAvailableQuery,
  federationAllowlistQuery,
  removeFromAllowlist,
} from "@/api/federation-allowlist";
import { wellKnownQuery } from "@/api/matrix";
import * as Card from "@/components/card";
import * as Navigation from "@/components/navigation";
import * as Table from "@/components/table";
import AppFooter from "@/ui/footer";
import * as Marketing from "@/ui/marketing";
import { Heading } from "./_console.federation";

const ALLOWLIST_PAGE_SIZE = 100;

export const Route = createFileRoute("/_console/federation/allowed-domains")({
  loader: async ({ context: { queryClient, credentials } }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;
    await queryClient.ensureQueryData(essVersionQuery(synapseRoot));

    const available = await queryClient.ensureQueryData(
      federationAllowlistAvailableQuery(synapseRoot),
    );

    if (available) {
      await queryClient.ensureQueryData(
        federationAllowlistQuery(synapseRoot, 0, ALLOWLIST_PAGE_SIZE),
      );
    }
  },

  component: RouteComponent,
});

function RouteComponent() {
  const { credentials } = Route.useRouteContext();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const variant = useEssVariant(synapseRoot);
  const isPro = variant === "pro";

  const { data: sbgAvailable } = useSuspenseQuery(
    federationAllowlistAvailableQuery(synapseRoot),
  );

  return (
    <Navigation.Content>
      <Navigation.Main>
        <Heading />

        {isPro && sbgAvailable ? (
          <AllowlistManagement synapseRoot={synapseRoot} />
        ) : (
          <MarketingFallback isPro={isPro} sbgAvailable={sbgAvailable} />
        )}
      </Navigation.Main>

      <AppFooter />
    </Navigation.Content>
  );
}

function MarketingFallback({
  isPro,
  sbgAvailable,
}: {
  isPro: boolean;
  sbgAvailable: boolean;
}) {
  const intl = useIntl();
  return (
    <>
      {isPro ? (
        !sbgAvailable && (
          <Alert
            type="info"
            className="max-w-[80ch]"
            title={intl.formatMessage({
              id: "pages.federation.sbg_not_enabled.title",
              description:
                "Title of the alert explaining that allowed domains is part of the Secure Border Gateway and is not enabled",
              defaultMessage:
                "Allowed domains is a feature of the Secure Border Gateway available in ESS Pro",
            })}
          >
            <FormattedMessage
              id="pages.federation.sbg_not_enabled.description"
              description="Description of the alert explaining the SBG is not enabled on this deployment"
              defaultMessage="Secure Border Gateway is not enabled on this deployment. Contact your administrator to enable it."
            />
          </Alert>
        )
      ) : (
        <Alert
          type="info"
          className="max-w-[80ch]"
          title={intl.formatMessage({
            id: "pages.federation.unavailable_alert.title",
            description:
              "Title of the alert explaining that allowed domains is only available in ESS Pro",
            defaultMessage:
              "Allowed domains is a feature of the Secure Border Gateway available in ESS Pro",
          })}
        >
          <FormattedMessage
            id="pages.federation.unavailable_alert.description"
            description="Description of the alert explaining that the Secure Border Gateway is only available in ESS Pro"
            defaultMessage="Secure Border Gateway is not available in ESS Community. Upgrade to ESS Pro to enable it."
          />
        </Alert>
      )}

      <Card.Stack>
        <Marketing.SBGCard proBadge={!isPro} />
        {!isPro && <Marketing.AlsoAvailableInPro />}
      </Card.Stack>
    </>
  );
}

function AllowlistManagement({ synapseRoot }: { synapseRoot: string }) {
  const queryClient = useQueryClient();
  const intl = useIntl();
  const formRef = useRef<HTMLFormElement>(null);

  // TODO: handle pagination
  const { data: allowlist } = useSuspenseQuery(
    federationAllowlistQuery(synapseRoot, 0, ALLOWLIST_PAGE_SIZE),
  );

  const addMutation = useMutation({
    mutationFn: (serverName: string) =>
      addToAllowlist(queryClient, synapseRoot, [serverName]),

    async onSuccess() {
      toast.success(
        intl.formatMessage({
          id: "pages.federation.allowlist.add.success",
          defaultMessage: "Domain added to allowlist",
          description:
            "Toast message when a domain is added to the federation allowlist",
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: ["federation", "allowlist"],
      });
      formRef.current?.reset();
    },

    onError() {
      toast.error(
        intl.formatMessage({
          id: "pages.federation.allowlist.add.error",
          defaultMessage: "Failed to add domain to allowlist",
          description:
            "Toast message when adding a domain to the federation allowlist fails",
        }),
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (serverName: string) =>
      removeFromAllowlist(queryClient, synapseRoot, [serverName]),

    async onSuccess() {
      toast.success(
        intl.formatMessage({
          id: "pages.federation.allowlist.remove.success",
          defaultMessage: "Domain removed from allowlist",
          description:
            "Toast message when a domain is removed from the federation allowlist",
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: ["federation", "allowlist"],
      });
    },

    onError() {
      toast.error(
        intl.formatMessage({
          id: "pages.federation.allowlist.remove.error",
          defaultMessage: "Failed to remove domain from allowlist",
          description:
            "Toast message when removing a domain from the federation allowlist fails",
        }),
      );
    },
  });

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pattern = formData.get("pattern") as string;
    const trimmed = pattern.trim();
    if (trimmed) {
      addMutation.mutate(trimmed);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Table.Header>
        <Table.Title>
          <FormattedMessage
            id="pages.federation.allowlist.heading"
            defaultMessage="List of patterns allowed to federate with you"
            description="Heading for the federation allowlist section"
          />
        </Table.Title>
      </Table.Header>

      <Form.Root onSubmit={handleSubmit} ref={formRef}>
        <div className="flex flex-col gap-2 max-w-xl">
          <Form.Field name="pattern">
            <Form.Label>
              <FormattedMessage
                id="pages.federation.allowlist.add_pattern"
                defaultMessage="Add pattern"
                description="Label for the input to add a federation allowlist pattern"
              />
            </Form.Label>

            <div className="flex gap-4 items-center">
              <Form.TextControl
                className="flex-1"
                disabled={addMutation.isPending}
              />

              <Form.Submit
                type="submit"
                kind="primary"
                size="lg"
                disabled={addMutation.isPending}
              >
                {addMutation.isPending && <InlineSpinner />}
                <FormattedMessage
                  id="pages.federation.allowlist.add_domain"
                  defaultMessage="Add domain"
                  description="Button to add a domain pattern to the federation allowlist"
                />
              </Form.Submit>
            </div>

            <Form.HelpMessage>
              <FormattedMessage
                id="pages.federation.allowlist.add_pattern.help"
                defaultMessage="Enter a domain like example.com or use * to allow all subdomains, like *.example.com"
                description="Help text for the federation allowlist pattern input"
              />
            </Form.HelpMessage>
          </Form.Field>
        </div>
      </Form.Root>

      <div className="flex flex-col">
        {allowlist.server_names.map((entry) => (
          <div
            key={entry.server_name}
            className="flex items-center justify-between border-b border-bg-subtle-secondary px-4 py-4"
          >
            <Text size="md" weight="semibold" className="text-text-primary">
              {entry.server_name}
            </Text>

            <Tooltip
              label={intl.formatMessage({
                id: "pages.federation.allowlist.remove_tooltip",
                defaultMessage: "Remove from allowlist",
                description:
                  "Tooltip for the button to remove a domain from the federation allowlist",
              })}
            >
              <Button
                iconOnly
                kind="tertiary"
                size="md"
                destructive
                Icon={DeleteIcon}
                onClick={() => removeMutation.mutate(entry.server_name)}
                disabled={removeMutation.isPending}
              />
            </Tooltip>
          </div>
        ))}

        {allowlist.server_names.length === 0 && (
          <div className="py-8 text-center">
            <Text size="md" className="text-text-secondary">
              <FormattedMessage
                id="pages.federation.allowlist.empty"
                defaultMessage="No domains in the allowlist yet. Add a domain pattern above to get started."
                description="Empty state message for the federation allowlist"
              />
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}
