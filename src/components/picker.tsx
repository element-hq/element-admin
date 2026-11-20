// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { size } from "@floating-ui/react";
import { Form } from "@vector-im/compound-web";
import cx from "classnames";
import { forwardRef } from "react";

import styles from "./picker.module.css";

/**
 * Middleware for the picker's `useFloating`. It sets the CSS variables which
 * the `Floating` styles use to match the input width and fit on screen.
 */
export const floatingMiddleware = [
  size({
    // Gives a bit of padding with the bottom of the screen
    padding: 16,
    apply({ rects, elements, availableHeight }) {
      elements.floating.style.setProperty(
        "--reference-width",
        `${rects.reference.width}px`,
      );
      elements.floating.style.setProperty(
        "--reference-height",
        `${rects.reference.height}px`,
      );
      elements.floating.style.setProperty(
        "--available-height",
        `${availableHeight}px`,
      );
    },
  }),
];

// The search input, which stays above the floating panel
export const Input = forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof Form.TextControl>
>(function Input({ className, ...props }, ref) {
  return (
    <Form.TextControl
      ref={ref}
      className={cx(styles["reference"], className)}
      {...props}
    />
  );
});

// The panel under the input, holding the list or a placeholder
export const Floating = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(function Floating({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cx(styles["floating"], className)} {...props} />
  );
});

type ListProps = React.ComponentPropsWithoutRef<"ul"> & {
  /** Greys out the items, for when they may not match the search yet. */
  busy?: boolean;
};
export const List = ({ className, busy, ...props }: ListProps) => (
  <ul className={cx(styles["list"], className)} aria-busy={busy} {...props} />
);

type ItemProps = React.ComponentPropsWithoutRef<"li"> & {
  active: boolean;
  disabled?: boolean;
};
export const Item = forwardRef<HTMLLIElement, ItemProps>(function Item(
  { className, active, disabled = false, ...props },
  ref,
) {
  return (
    <li
      ref={ref}
      {...props}
      className={cx(styles["item"], className)}
      data-active={active}
      // The `option` role comes from floating-ui's `getItemProps`
      // oxlint-disable-next-line jsx-a11y/role-supports-aria-props
      aria-disabled={disabled || undefined}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={active ? 0 : -1}
    />
  );
});

type DivProps = React.ComponentPropsWithoutRef<"div">;

// Shown in the floating panel in place of the list
export const Loading = ({ className, ...props }: DivProps) => (
  <div className={cx(styles["loading"], className)} {...props} />
);

export const Empty = ({ className, ...props }: DivProps) => (
  <div className={cx(styles["empty"], className)} {...props} />
);

export const EmptyTitle = ({ className, ...props }: DivProps) => (
  <div className={cx(styles["headline"], className)} {...props} />
);

export const EmptyHelp = ({ className, ...props }: DivProps) => (
  <div className={cx(styles["help"], className)} {...props} />
);

// The chosen item and its buttons, shown in place of the input
export const Selection = ({ className, ...props }: DivProps) => (
  <div className={cx(styles["selection"], className)} {...props} />
);

export const Chip = ({ className, ...props }: DivProps) => (
  <div className={cx(styles["chip"], className)} {...props} />
);

// Two lines of text, used in list items and in the chip
export const Infos = ({ className, ...props }: DivProps) => (
  <div className={cx(styles["infos"], className)} {...props} />
);

export const Primary = ({ className, ...props }: DivProps) => (
  <div className={cx(styles["primary"], className)} {...props} />
);

export const Secondary = ({ className, ...props }: DivProps) => (
  <div className={cx(styles["secondary"], className)} {...props} />
);
