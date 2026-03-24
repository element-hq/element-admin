// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import { essVersionQuery } from "@/api/ess";
import { federationAllowlistAvailableQuery } from "@/api/federation-allowlist";
import { wellKnownQuery } from "@/api/matrix";
import * as Page from "@/components/page";
import * as SubTabs from "@/components/sub-tabs";

const titleMessage = defineMessage({
  id: "pages.federation.title",
  defaultMessage: "Federation",
  description: "The title of the federation page",
});

/**
 * Common "heading" part for the federation page
 */
export const Heading = ({ search }: { search?: React.ReactNode }) => {
  const t = useIntl();
  return (
    <>
      <Page.Header>
        <Page.Title>
          <FormattedMessage {...titleMessage} />
        </Page.Title>
        {search}
      </Page.Header>

      <SubTabs.Root
        aria-label={t.formatMessage({
          id: "pages.federation.tab.section",
          defaultMessage: "Federation views",
          description: "The label for the federation tabs section",
        })}
      >
        <SubTabs.Tab to="/federation/known-domains">
          <FormattedMessage
            id="pages.federation.tab.known_domains"
            defaultMessage="Known domains"
            description="Tab label for the known federation domains list"
          />
        </SubTabs.Tab>
        <SubTabs.Tab to="/federation/allowed-domains">
          <FormattedMessage
            id="pages.federation.tab.allowed_domains"
            defaultMessage="Allowed domains"
            description="Tab label for the allowed federation domains list"
          />
        </SubTabs.Tab>
      </SubTabs.Root>
    </>
  );
};

export const Route = createFileRoute("/_console/federation")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  loader: async ({ context: { queryClient, credentials } }): Promise<void> => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;
    await queryClient.ensureQueryData(essVersionQuery(synapseRoot));
    await queryClient.ensureQueryData(
      federationAllowlistAvailableQuery(synapseRoot),
    );
  },

  component: () => <Outlet />,
});
