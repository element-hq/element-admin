import { createLink } from "@tanstack/react-router";
import { SearchIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import cx from "classnames";
import { forwardRef } from "react";

import styles from "./page.module.css";

type HeaderProps = React.ComponentProps<"header">;
export const Header = ({ className, children, ...props }: HeaderProps) => (
  <header className={cx(styles["header"], className)} {...props}>
    {children}
  </header>
);

type TitleProps = React.ComponentProps<"h1">;
export const Title = ({ className, children, ...props }: TitleProps) => (
  <h1 className={cx(styles["title"], className)} {...props}>
    {children}
  </h1>
);

type ControlsProps = React.ComponentProps<"div">;
export const Controls = ({ className, children, ...props }: ControlsProps) => (
  <div className={cx(styles["controls"], className)} {...props}>
    {children}
  </div>
);

interface LinkButtonProps extends React.ComponentProps<"a"> {
  variant?: "primary" | "secondary";
  Icon: React.ComponentType<React.SVGAttributes<SVGElement>>;
}
export const LinkButton = createLink(
  forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
    { className, variant = "primary", children, Icon, ...props },
    ref,
  ) {
    return (
      <a
        data-variant={variant}
        className={cx(styles["link-button"], className)}
        {...props}
        ref={ref}
      >
        <Icon />
        <div className={styles["link-button-text"]}>{children}</div>
      </a>
    );
  }),
);

export const Search = forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(function Search({ className, ...props }, ref) {
  return (
    <div className={cx(styles["search"], className)}>
      <input type="search" {...props} ref={ref} />
      <SearchIcon />
    </div>
  );
});
