import {
  flexRender,
  type Cell,
  type Header as THeader,
  type Table,
} from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { FilterIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Menu } from "@vector-im/compound-web";
import cx from "classnames";
import {
  forwardRef,
  Fragment,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
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

interface ListHeaderProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: Table<any>;
}
const ListHeader = forwardRef<HTMLTableSectionElement, ListHeaderProps>(
  function ListHeader({ table }, ref) {
    return (
      <thead className={styles["thead"]} ref={ref}>
        <tr className={styles["header-row"]}>
          {table.getHeaderGroups().map((headerGroup) => (
            <Fragment key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <ListHeaderCell key={header.id} header={header} />
              ))}
            </Fragment>
          ))}
        </tr>
      </thead>
    );
  },
);

interface ListHeaderCellProps
  extends Omit<React.ComponentProps<"th">, "children"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  header: THeader<any, any>;
}
const ListHeaderCell = forwardRef<HTMLTableCellElement, ListHeaderCellProps>(
  function ListHeaderCell({ header, className, ...props }, ref) {
    return (
      <th ref={ref} className={cx(styles["header-cell"], className)} {...props}>
        <div className={styles["header-cell-content"]}>
          <span className={styles["header-label"]}>
            {header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        </div>
      </th>
    );
  },
);

interface VirtualizedListProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: Table<any>;
  fetchNextPage?: () => void;
  canFetchNextPage?: boolean;
}

export const VirtualizedList = forwardRef<HTMLDivElement, VirtualizedListProps>(
  function VirtualizedList(
    { fetchNextPage, canFetchNextPage, table, className, style, ...props },
    ref,
  ) {
    const headerRef = useRef<HTMLTableSectionElement | null>(null);
    const listRef = useRef<HTMLTableSectionElement | null>(null);
    const { rows } = table.getRowModel();
    const rowVirtualizer = useWindowVirtualizer({
      count: rows.length,
      estimateSize: () => 56,
      overscan: 5,
      // Because we're using a window virtualizer, we need to calculate the
      // offset with the window top. Even though this looks complicated, this
      // will be relatively stable (unless the window gets resized and layout
      // shifts), around 300px.
      // The virtualiser installs a ResizeObserver to look for window resizes,
      // this component will re-render anyway when the window resizes, so we
      // don't have to look for that ourselves.
      scrollMargin:
        (listRef.current?.getBoundingClientRect().top ?? 0) +
        globalThis.window.scrollY,
    });

    // Prevent the compiler from optimizing it
    // See https://github.com/TanStack/virtual/issues/743
    const rowVirtualizerRef = useRef(rowVirtualizer);

    const virtualItems = rowVirtualizerRef.current.getVirtualItems();

    useEffect(() => {
      const lastVirtualItem = virtualItems.at(-1);
      if (!lastVirtualItem || !fetchNextPage || !canFetchNextPage) return;

      // Start fetching the next page if we're close to the bottom
      if (lastVirtualItem.index > rows.length - 50) {
        fetchNextPage();
      }
    }, [canFetchNextPage, fetchNextPage, virtualItems, rows]);

    return (
      <div
        className={cx(styles["list"], className)}
        style={{
          height: `${rowVirtualizerRef.current.getTotalSize() + (headerRef.current?.clientHeight ?? 40)}px`,
          ...style,
        }}
        {...props}
        ref={ref}
      >
        <table cellSpacing="0" cellPadding="0" className={styles["table"]}>
          <ListHeader table={table} ref={headerRef} />
          <tbody className={styles["tbody"]} ref={listRef}>
            {virtualItems.map((virtualRow, index) => {
              const row = rows[virtualRow.index];
              if (!row)
                throw new Error("got a virtual row for a non-existing row");

              return (
                <tr
                  key={row.id}
                  className={styles["row"]}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${
                      virtualRow.start -
                      index * virtualRow.size -
                      rowVirtualizerRef.current.options.scrollMargin
                    }px)`,
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <ListCell key={cell.id} cell={cell} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },
);

// Table Cell
interface ListCellProps extends Omit<React.ComponentProps<"td">, "children"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cell: Cell<any, any>;
}

const ListCell = forwardRef<HTMLTableCellElement, ListCellProps>(
  function ListCell({ cell, className, ...props }, ref) {
    return (
      <td ref={ref} className={cx(styles["cell"], className)} {...props}>
        {flexRender(cell.column.columnDef.cell, cell.getContext())}
      </td>
    );
  },
);
