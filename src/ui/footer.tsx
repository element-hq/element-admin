import { Link } from "@vector-im/compound-web";
import { FormattedMessage } from "react-intl";

import * as Footer from "@/components/footer";
import { LanguageSwitcher } from "@/ui/language-switcher";

const AppFooter = () => (
  <Footer.Root>
    <Footer.ElementLogo />

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
      <Footer.Divider />
      <LanguageSwitcher />
    </Footer.Section>
  </Footer.Root>
);

export default AppFooter;
