import { FormattedMessage } from "react-intl";
import styles from "./footer.module.css";
import { ElementLogotype } from "./logo";

export const Root: React.FC<React.PropsWithChildren> = ({ children }) => (
  <footer className={styles["root"]}>{children}</footer>
);

export const PoweredBy: React.FC = () => (
  <div className={styles["powered-by"]}>
    <FormattedMessage
      id="footer.powered_by"
      defaultMessage="Powered by {logo}"
      values={{ logo: <ElementLogotype /> }}
    />
  </div>
);

export const Divider: React.FC = () => (
  <div
    role="separator"
    aria-orientation="vertical"
    className={styles["divider"]}
  />
);

export const Section: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className={styles["section"]}>{children}</div>
);

export const CopyrightNotice: React.FC = () => (
  <div className={styles["copyright-notice"]}>
    <FormattedMessage
      id="footer.copyright_notice"
      defaultMessage="Copyright © {year}"
      values={{ year: new Date().getFullYear() }}
    />
  </div>
);
