// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

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

interface BaseButtonProps {
  variant?: "primary" | "secondary";
  Icon: React.ComponentType<React.SVGAttributes<SVGElement>>;
}

interface ButtonProps extends React.ComponentProps<"button">, BaseButtonProps {}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", children, Icon, ...props },
    ref,
  ) {
    return (
      <button
        data-variant={variant}
        className={cx(styles["button"], className)}
        type="button"
        {...props}
        ref={ref}
      >
        <Icon />
        <div className={styles["button-text"]}>{children}</div>
      </button>
    );
  },
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
