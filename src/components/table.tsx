import {
  ChevronDownIcon,
  FilterIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import cx from "classnames";
import { forwardRef } from "react";
import { useIntl } from "react-intl";

import styles from "./table.module.css";

// Root Container
type RootProps = React.ComponentProps<"div">;
export const Root = ({ className, children, ...props }: RootProps) => (
  <div className={cx(styles["root"], className)} {...props}>
    {children}
  </div>
);

// Table Header (title, count, controls)
type HeaderProps = React.ComponentProps<"div">;
export const Header = ({ className, children, ...props }: HeaderProps) => (
  <div className={cx(styles["header"], className)} {...props}>
    {children}
  </div>
);

type TitleProps = React.ComponentProps<"div">;
export const Title = ({ className, children, ...props }: TitleProps) => (
  <div className={cx(styles["header-title"], className)} {...props}>
    {children}
  </div>
);

type ControlsProps = React.ComponentProps<"div">;
export const Controls = ({ className, children, ...props }: ControlsProps) => (
  <div className={cx(styles["header-controls"], className)} {...props}>
    {children}
  </div>
);

type ShowingProps = React.ComponentProps<"div">;
export const Showing = ({ className, children, ...props }: ShowingProps) => (
  <div className={cx(styles["header-showing"], className)} {...props}>
    {children}
  </div>
);

// Filter Button
export const FilterButton = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(function FilterButton({ className, children, ...props }, ref) {
  const intl = useIntl();
  return (
    <button
      ref={ref}
      className={cx(styles["filter-button"], className)}
      type="button"
      aria-label={intl.formatMessage({
        id: "common.filter",
        defaultMessage: "Filter",
        description: "Label for a filter section/button",
      })}
      {...props}
    >
      <FilterIcon className={styles["filter-icon"]} />
      {children}
    </button>
  );
});

// Table List Container
type ListProps = React.ComponentProps<"div">;
export const List = ({ className, children, ...props }: ListProps) => (
  <div className={cx(styles["list"], className)} {...props}>
    <table cellSpacing="0" cellPadding="0" className={styles["table"]}>
      {children}
    </table>
  </div>
);

// Table Header Section
type ListHeaderProps = React.ComponentProps<"thead">;
export const ListHeader = ({
  className,
  children,
  ...props
}: ListHeaderProps) => (
  <thead className={cx(styles["thead"], className)} {...props}>
    <tr className={styles["header-row"]}>{children}</tr>
  </thead>
);

// Table Header Cell
interface ListHeaderCellProps extends React.ComponentProps<"th"> {
  sortable?: boolean;
  sortDirection?: "asc" | "desc";
  align?: "left" | "center" | "right";
}

export const ListHeaderCell = forwardRef<
  HTMLTableCellElement,
  ListHeaderCellProps
>(function ListHeaderCell(
  {
    children,
    sortable,
    sortDirection,
    align = "left",
    className,
    onClick,
    ...props
  },
  ref,
) {
  return (
    <th
      ref={ref}
      className={cx(
        styles["header-cell"],
        sortable && styles["sortable"],
        styles[`align-${align}`],
        className,
      )}
      onClick={sortable ? onClick : undefined}
      {...props}
    >
      <div className={styles["header-cell-content"]}>
        <span className={styles["header-label"]}>{children}</span>
        {sortable && (
          <ChevronDownIcon
            className={cx(
              styles["sort-icon"],
              styles[`sort-icon-${sortDirection || "none"}`],
            )}
          />
        )}
      </div>
    </th>
  );
});

// Table Body
type ListBodyProps = React.ComponentProps<"tbody">;
export const ListBody = ({ className, children, ...props }: ListBodyProps) => (
  <tbody className={cx(styles["tbody"], className)} {...props}>
    {children}
  </tbody>
);

// Table Row
interface ListRowProps extends React.ComponentProps<"tr"> {
  clickable?: boolean;
}

export const ListRow = forwardRef<HTMLTableRowElement, ListRowProps>(
  function ListRow({ children, clickable, className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        className={cx(
          styles["row"],
          clickable && styles["clickable"],
          className,
        )}
        {...props}
      >
        {children}
      </tr>
    );
  },
);

// Table Cell
interface ListCellProps extends React.ComponentProps<"td"> {
  align?: "left" | "center" | "right";
}

export const ListCell = forwardRef<HTMLTableCellElement, ListCellProps>(
  function ListCell({ children, align = "left", className, ...props }, ref) {
    return (
      <td
        ref={ref}
        className={cx(styles["cell"], styles[`align-${align}`], className)}
        {...props}
      >
        {children}
      </td>
    );
  },
);
