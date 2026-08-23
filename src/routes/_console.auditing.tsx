// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Alert } from "@vector-im/compound-web";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import { essVersionQuery, useEssVariant } from "@/api/ess";
import { wellKnownQuery } from "@/api/matrix";
import * as Card from "@/components/card";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import AppFooter from "@/ui/footer";
import * as Marketing from "@/ui/marketing";

const titleMessage = defineMessage({
  id: "pages.auditing.title",
  defaultMessage: "Auditing",
  description: "The title of the auditing page",
});

export const Route = createFileRoute("/_console/auditing")({
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
  const intl = useIntl();
  const isPro = variant === "pro";

  return (
    <Navigation.Content>
      <Navigation.Main>
        <Page.Header>
          <Page.Title>
            <FormattedMessage {...titleMessage} />
          </Page.Title>
        </Page.Header>

        {!isPro && (
          <Alert
            type="info"
            className="max-w-[80ch]"
            title={intl.formatMessage({
              id: "pages.auditing.unavailable_alert.title",
              description:
                "Title of the alert explaining that the auditing feature is only available in ESS Pro",
              defaultMessage: "Auditing is a feature available in ESS Pro",
            })}
          >
            <FormattedMessage
              id="pages.auditing.unavailable_alert.description"
              description="Description of the alert explaining that the auditing feature is only available in ESS Pro"
              defaultMessage="This feature is not available in ESS Community. Upgrade to ESS Pro to enable it."
            />
          </Alert>
        )}

        <Card.Stack>
          <Marketing.AuditingCard proBadge={!isPro} />
          {!isPro && <Marketing.AlsoAvailableInPro />}
        </Card.Stack>
      </Navigation.Main>
      <AppFooter />
    </Navigation.Content>
  );
}
