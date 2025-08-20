import cx from "classnames";
import styles from "./layout.module.css";

const Layout: React.FC<
  React.PropsWithChildren<{ withGradient?: boolean; className?: string }>
> = ({ children, className, withGradient }) => (
  <div
    className={cx(
      className,
      styles["root"],
      withGradient && styles["with-gradient"],
    )}
  >
    {children}
  </div>
);

export default Layout;
