import { createLink } from "@tanstack/react-router";
import { forwardRef, type PropsWithChildren } from "react";
import cx from "classnames";
import styles from "./navigation.module.css";

type Props = PropsWithChildren;
export const Root: React.FC<Props> = ({ children }: Props) => (
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
>(function NavAnchor({ children, Icon, className, ...props }, ref) {
  return (
    <a ref={ref} className={cx(styles["nav-link"], className)} {...props}>
      <Icon className={styles["nav-link-icon"]} />
      <div className={styles["nav-link-label"]}>{children}</div>
    </a>
  );
});

export const NavLink = createLink(NavAnchor);

type ContentProps = PropsWithChildren;
export const Content: React.FC<ContentProps> = ({ children }: ContentProps) => (
  <div className={styles["content"]}>{children}</div>
);

type MainProps = PropsWithChildren;
export const Main: React.FC<MainProps> = ({ children }: MainProps) => (
  <main className={styles["main"]}>{children}</main>
);

type SidebarProps = PropsWithChildren;
export const Sidebar: React.FC<SidebarProps> = ({ children }: SidebarProps) => (
  <div className={styles["sidebar"]}>
    <nav className={styles["sidebar-inner"]}>
      <div className={styles["sidebar-sticky"]}>
        <div className={styles["sidebar-content"]}>{children}</div>
      </div>
    </nav>
  </div>
);
