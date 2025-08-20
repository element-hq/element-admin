import { createLink } from "@tanstack/react-router";
import { forwardRef, type PropsWithChildren } from "react";
import styles from "./navigation.module.css";
import cx from "classnames";

export const Root: React.FC<PropsWithChildren<{}>> = ({ children }) => (
  <div className={styles["root"]}>{children}</div>
);

export const Divider: React.FC = () => (
  <div className={styles["divider"]} role="separator" />
);

export const NavAnchor = forwardRef<
  HTMLAnchorElement,
  {
    Icon: React.ComponentType<React.SVGAttributes<SVGElement>>;
  } & PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>
>(({ children, Icon, className, ...props }, ref) => {
  return (
    <a ref={ref} className={cx(styles["nav-link"], className)} {...props}>
      <Icon className={styles["nav-link-icon"]} />
      <div className={styles["nav-link-label"]}>{children}</div>
    </a>
  );
});

export const NavLink = createLink(NavAnchor);

export const Content: React.FC<PropsWithChildren<{}>> = ({ children }) => (
  <main className={styles["content"]}>{children}</main>
);

export const Sidebar: React.FC<PropsWithChildren<{}>> = ({ children }) => (
  <div className={styles["sidebar"]}>
    <nav className={styles["sidebar-inner"]}>
      <div className={styles["sidebar-content"]}>{children}</div>
    </nav>
  </div>
);
