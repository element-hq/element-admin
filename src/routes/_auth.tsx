// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Link, Text } from "@vector-im/compound-web";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import * as Footer from "@/components/footer";
import { WelcomeLayout } from "@/components/layout";
import { EssLogotypeVertical } from "@/components/logo";
import { useAuthStore } from "@/stores/auth";
import { LanguageSwitcher } from "@/ui/language-switcher";

const welcomeMessage = defineMessage({
  id: "pages.landing.description",
  defaultMessage:
    "Manage the deployment of the element app for your organization or community.",
  description: "On the landing pages, explains what the app does",
});

export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    const state = useAuthStore.getState();
    if (state.credentials) {
      throw redirect({ to: "/" });
    }
  },

  component: RouteComponent,
});

function RouteComponent() {
  const intl = useIntl();
  return (
    <>
      <meta name="description" content={intl.formatMessage(welcomeMessage)} />
      <WelcomeLayout className="gap-10 py-10 items-center justify-center">
        <main className="flex flex-col flex-1 gap-12 items-stretch justify-center max-w-[340px]">
          {/* Logo & message */}
          <div className="flex flex-col gap-6 items-center text-center">
            <EssLogotypeVertical />

            <Text size="md" className="text-text-secondary">
              <FormattedMessage {...welcomeMessage} />
            </Text>
          </div>

          <div>
            <Outlet />
          </div>
        </main>

        <Footer.Root>
          <Footer.ElementLogo />

          <Footer.Divider />

          <Footer.Section>
            <Link href="https://customer.element.io/support" size="small">
              <FormattedMessage
                id="footer.help_and_support"
                defaultMessage="Help & Support"
                description="Label for the help and support (to https://customer.element.io/support) link in the footer"
              />
            </Link>
            <Footer.Divider />
            <Link href="https://element.io/legal" size="small">
              <FormattedMessage
                id="footer.legal"
                defaultMessage="Legal"
                description="Label for the legal (to https://element.io/legal) link in the footer"
              />
            </Link>
            <Footer.Divider />
            <Link href="https://element.io/legal/privacy" size="small">
              <FormattedMessage
                id="footer.privacy"
                defaultMessage="Privacy"
                description="Label for the privacy (to https://element.io/legal/privacy) link in the footer"
              />
            </Link>
          </Footer.Section>

          <Footer.Divider />

          <Footer.Section>
            <Footer.CopyrightNotice />
            <Footer.Divider />
            <LanguageSwitcher />
          </Footer.Section>
        </Footer.Root>
      </WelcomeLayout>
    </>
  );
}
