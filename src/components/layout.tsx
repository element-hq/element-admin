import cx from "classnames";
import styles from "./layout.module.css";

export const Layout: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = ({ children, className }) => (
  <div className={cx(className, styles["layout"])}>{children}</div>
);

export const WelcomeLayout: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = ({ children, className }) => (
  <div className={cx(className, styles["welcome-layout"])}>
    <div aria-hidden="true" className={styles["welcome-gradient"]} />
    {children}
  </div>
);
