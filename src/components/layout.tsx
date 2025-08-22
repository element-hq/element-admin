import cx from "classnames";

import styles from "./layout.module.css";

type LayoutProps = React.PropsWithChildren<{ className?: string }>;
export const Layout: React.FC<LayoutProps> = ({
  children,
  className,
}: LayoutProps) => (
  <div className={cx(className, styles["layout"])}>{children}</div>
);

type WelcomeLayoutProps = React.PropsWithChildren<{ className?: string }>;
export const WelcomeLayout: React.FC<WelcomeLayoutProps> = ({
  children,
  className,
}: WelcomeLayoutProps) => (
  <div className={cx(className, styles["welcome-layout"])}>
    <div aria-hidden="true" className={styles["welcome-gradient"]} />
    {children}
  </div>
);
