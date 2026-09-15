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
} from "@vector-im/compound-web";
import { useRef, useState } from "react";
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
import * as DataTable from "@/components/data-table";
import * as Dialog from "@/components/dialog";
import * as Navigation from "@/components/navigation";
import * as messages from "@/messages";
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
                "Title of the alert explaining that the Secure Border Gateway is not enabled on this deployment, shown to an ESS Pro customer who already owns the feature",
              defaultMessage:
                "Secure Border Gateway isn't enabled on this deployment",
            })}
          >
            <FormattedMessage
              id="pages.federation.sbg_not_enabled.description"
              description="Description of the alert explaining what to do about the Secure Border Gateway not being enabled, under a title which already says that it isn't"
              defaultMessage="Contact your administrator to enable it in your deployment configuration."
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
      <DataTable.Header>
        <DataTable.Title>
          <FormattedMessage
            id="pages.federation.allowlist.heading"
            defaultMessage="List of patterns allowed to federate with you"
            description="Heading for the federation allowlist section"
          />
        </DataTable.Title>
      </DataTable.Header>

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
            className="flex items-center justify-between border-b border-separator-primary px-4 py-4"
          >
            <Text size="md" weight="semibold" className="text-text-primary">
              {entry.server_name}
            </Text>

            <RemoveAllowlistEntryButton
              synapseRoot={synapseRoot}
              serverName={entry.server_name}
            />
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

function RemoveAllowlistEntryButton({
  synapseRoot,
  serverName,
}: {
  synapseRoot: string;
  serverName: string;
}) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const removeMutation = useMutation({
    mutationFn: () =>
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
      setOpen(false);
    },
  });

  const onOpenChange = (nextOpen: boolean) => {
    if (removeMutation.isPending) return;
    setOpen(nextOpen);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <Button
          iconOnly
          kind="tertiary"
          size="md"
          destructive
          Icon={DeleteIcon}
          aria-label={intl.formatMessage({
            id: "pages.federation.allowlist.remove_tooltip",
            defaultMessage: "Remove from allowlist",
            description:
              "Accessible label for the button to remove a domain from the federation allowlist",
          })}
        />
      }
    >
      <Dialog.Title>
        <FormattedMessage
          id="pages.federation.allowlist.remove_confirm.title"
          defaultMessage="Remove {serverName} from the allowlist?"
          description="Title of the confirmation dialog for removing a domain from the federation allowlist"
          values={{ serverName }}
        />
      </Dialog.Title>

      <Dialog.Description asChild>
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: "pages.federation.allowlist.remove_confirm.alert.title",
            description:
              "Title of the alert in the confirmation dialog for removing a domain from the federation allowlist",
            defaultMessage: "You’re about to stop federating with this server",
          })}
        >
          <FormattedMessage
            id="pages.federation.allowlist.remove_confirm.alert.description"
            description="Description of the alert in the confirmation dialog for removing a domain from the federation allowlist"
            defaultMessage="Your server will stop federating with servers matching this pattern."
          />
        </Alert>
      </Dialog.Description>

      {removeMutation.isError && (
        <Dialog.ErrorAlert
          title={intl.formatMessage({
            id: "pages.federation.allowlist.remove.error",
            defaultMessage: "Failed to remove domain from allowlist",
            description:
              "Error shown in the confirmation dialog when removing a domain from the federation allowlist fails",
          })}
        />
      )}

      <Button
        kind="primary"
        destructive
        disabled={removeMutation.isPending}
        onClick={() => removeMutation.mutate()}
        Icon={removeMutation.isPending ? undefined : DeleteIcon}
      >
        {removeMutation.isPending && <InlineSpinner />}
        <FormattedMessage {...messages.actionRemove} />
      </Button>

      <Dialog.Close asChild>
        <Button kind="tertiary" disabled={removeMutation.isPending}>
          <FormattedMessage {...messages.actionCancel} />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
  );
}
