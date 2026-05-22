// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { Link } from "@vector-im/compound-web";
import { FormattedMessage } from "react-intl";

import * as Footer from "@/components/footer";
import { LanguageSwitcher } from "@/ui/language-switcher";

const AppFooter = () => (
  <Footer.Root>
    <Footer.ElementLogo />

    <Footer.Section>
      <Link href="https://customer.element.io/support" size="sm">
        <FormattedMessage
          id="footer.help_and_support"
          defaultMessage="Help & Support"
          description="Label for the help and support (to https://customer.element.io/support) link in the footer"
        />
      </Link>
      <Footer.Divider />
      <Link href="https://element.io/legal" size="sm">
        <FormattedMessage
          id="footer.legal"
          defaultMessage="Legal"
          description="Label for the legal (to https://element.io/legal) link in the footer"
        />
      </Link>
      <Footer.Divider />
      <Link href="https://element.io/legal/privacy" size="sm">
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
);

export default AppFooter;
