import { FormattedMessage } from "react-intl";
import { Link, Text } from "@vector-im/compound-web";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import * as Footer from "@/components/footer";
import { useAuthStore } from "@/stores/auth";
import { EssLogotypeVertical } from "@/components/logo";
import { WelcomeLayout } from "@/components/layout";

export const Route = createFileRoute("/_auth")({
  beforeLoad: () => {
    const state = useAuthStore.getState();
    if (state.credentials) {
      throw redirect({ to: "/" });
    }
  },

  component: () => {
    return (
      <WelcomeLayout className="gap-10 py-10 items-center justify-center">
        <section className="flex flex-col flex-1 gap-12 items-stretch justify-center max-w-[340px]">
          {/* Logo & message */}
          <div className="flex flex-col gap-6 items-center text-center">
            <EssLogotypeVertical />

            <Text size="md" className="text-text-secondary">
              Manage the deployment of the element app for your organization or
              community.
            </Text>
          </div>

          <div>
            <Outlet />
          </div>
        </section>

        <Footer.Root>
          <Footer.PoweredBy />

          <Footer.Divider />

          <Footer.Section>
            <Link href="https://ems.element.io/support" size="small">
              <FormattedMessage
                id="footer.help_and_support"
                defaultMessage="Help & Support"
                description="Label for the help and support (to https://ems.element.io/support) link in the footer"
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
          </Footer.Section>
        </Footer.Root>
      </WelcomeLayout>
    );
  },
});
