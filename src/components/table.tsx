import {
  ChevronDownIcon,
  FilterIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Menu } from "@vector-im/compound-web";
import cx from "classnames";
import { forwardRef, useId, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import * as messages from "@/messages";

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

type FilterProps = React.PropsWithChildren;
export const Filter = ({ children }: FilterProps) => {
  const [open, setOpen] = useState(false);
  const intl = useIntl();
  const title = intl.formatMessage(messages.commonFilter);
  return (
    <>
      <Menu
        open={open}
        onOpenChange={setOpen}
        title={title}
        align="end"
        trigger={<FilterButton />}
      >
        {children}
      </Menu>
    </>
  );
};

// Filter Button
export const FilterButton = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button">
>(function FilterButton({ className, ...props }, ref) {
  const labelId = useId();
  return (
    <button
      ref={ref}
      type="button"
      aria-labelledby={labelId}
      className={cx(className, styles["filter-button"])}
      {...props}
    >
      <FilterIcon className={styles["filter-icon"]} />

      <div className={styles["filter-button-label"]} id={labelId}>
        <FormattedMessage {...messages.commonFilter} />
      </div>
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
type ListRowProps = React.ComponentProps<"tr">;

export const ListRow = forwardRef<HTMLTableRowElement, ListRowProps>(
  function ListRow({ children, className, ...props }, ref) {
    return (
      <tr ref={ref} className={cx(styles["row"], className)} {...props}>
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
