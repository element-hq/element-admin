// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { createLink, type LinkComponent } from "@tanstack/react-router";
import {
  flexRender,
  type Cell,
  type CellData,
  type Header as THeader,
  type RowData,
  type Table,
  type TableFeatures,
} from "@tanstack/react-table";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  CloseIcon,
  FilterIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { InlineSpinner, Menu } from "@vector-im/compound-web";
import cx from "classnames";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FormattedMessage, useIntl } from "react-intl";

import * as messages from "@/messages";

import styles from "./data-table.module.css";

// The list itself intentionally builds an ARIA grid out of `div`s with roles
// (instead of native table tags) so the rows can be a CSS grid with shared,
// deterministic column tracks and absolute positioning for virtualization.
// oxlint-disable jsx-a11y/prefer-tag-over-role

// The grid takes its accessible name from `Title` (which renders the row count,
// e.g. "500 rooms"). `Root` mints the id so neither consumer has to.
const TitleIdContext = createContext<string | undefined>(undefined);

// Root Container
type RootProps = React.ComponentProps<"div">;
export const Root = ({ className, children, ...props }: RootProps) => {
  const titleId = useId();
  return (
    <TitleIdContext.Provider value={titleId}>
      <div className={cx(styles["root"], className)} {...props}>
        {children}
      </div>
    </TitleIdContext.Provider>
  );
};

// Table Header (title, count, controls)
type HeaderProps = React.ComponentProps<"div">;
export const Header = ({ className, children, ...props }: HeaderProps) => (
  <div className={cx(styles["header"], className)} {...props}>
    {children}
  </div>
);

type TitleProps = React.ComponentProps<"h2">;
export const Title = ({ className, children, ...props }: TitleProps) => (
  <h2
    id={useContext(TitleIdContext)}
    className={cx(styles["header-title"], className)}
    {...props}
  >
    {children}
  </h2>
);

type FilterMenuProps = React.PropsWithChildren;
export const FilterMenu = ({ children }: FilterMenuProps) => {
  const [open, setOpen] = useState(false);
  const intl = useIntl();
  const title = intl.formatMessage(messages.commonFilter);
  return (
    <Menu
      open={open}
      onOpenChange={setOpen}
      title={title}
      align="end"
      trigger={<FilterButton />}
    >
      {children}
    </Menu>
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
      className={cx(styles["filter-button"], className)}
      {...props}
    >
      <FilterIcon className={styles["filter-icon"]} />

      <div className={styles["filter-button-label"]} id={labelId}>
        <FormattedMessage {...messages.commonFilter} />
      </div>
    </button>
  );
});

// Filter list, under the header
export const ActiveFilterList = forwardRef<
  HTMLUListElement,
  React.ComponentPropsWithoutRef<"ul">
>(function ActiveFilterList({ className, ...props }, ref) {
  return (
    <ul
      className={cx(styles["active-filter-list"], className)}
      {...props}
      ref={ref}
    />
  );
});

export const ActiveFilter = forwardRef<
  HTMLLIElement,
  React.ComponentPropsWithoutRef<"li">
>(function ActiveFilter({ className, ...props }, ref) {
  return (
    <li
      className={cx(styles["active-filter"], className)}
      {...props}
      ref={ref}
    />
  );
});

const RemoveFilterButton = forwardRef<
  HTMLAnchorElement,
  Omit<React.ComponentPropsWithoutRef<"a">, "children">
>(function RemoveFilterButton({ className, ...props }, ref) {
  const intl = useIntl();
  return (
    <a
      ref={ref}
      type="button"
      className={cx(styles["remove-filter-button"], className)}
      title={intl.formatMessage(messages.actionRemove)}
      {...props}
    >
      <CloseIcon className={styles["remove-filter-icon"]} />
    </a>
  );
});

export const RemoveFilterLink = createLink(RemoveFilterButton);

export type ColumnWidth = { min: number; fr?: number } | { px: number };

declare module "@tanstack/react-table" {
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    width?: ColumnWidth;
  }
}

// Shared presets so a column of a given kind lines up the same way on every
// page — without them the same status badge column drifted between 140 and 150
// across the list pages.
export const columnWidth = {
  /** Avatar and/or name: the column holding the row link */
  primary: { min: 240, fr: 2 },
  /** A formatted date or timestamp */
  date: { min: 160, fr: 1 },
  /** A single status `<Badge>` */
  status: { min: 150, fr: 1 },
} as const satisfies Record<string, ColumnWidth>;

// A column without an explicit width falls back to a flexible track with a
// sensible minimum so it can never be crushed to nothing.
const DEFAULT_MIN_WIDTH = 120;

const gridTrack = (width: ColumnWidth | undefined): string => {
  if (!width) return `minmax(${DEFAULT_MIN_WIDTH}px, 1fr)`;
  if ("px" in width) return `${width.px}px`;
  return `minmax(${width.min}px, ${width.fr ?? 1}fr)`;
};

const trackMinWidth = (width: ColumnWidth | undefined): number => {
  if (!width) return DEFAULT_MIN_WIDTH;
  if ("px" in width) return width.px;
  return width.min;
};

// In a generic component, `columnDef.meta` is an unresolved conditional type
// (`ExtractColumnMeta`), so the augmented `width` property has to be read
// through a narrowing cast.
const metaWidth = (meta: unknown): ColumnWidth | undefined =>
  (meta as { width?: ColumnWidth } | undefined)?.width;

// Roving tabindex (WAI-ARIA grid keyboard model): the whole grid is a single
// tab stop — only one row is tabbable at a time, arrow keys move focus between
// rows, and Tab leaves the grid. `List` provides each row's tabindex through
// this context; outside a `List` the default keeps controls tabbable.
// An explicit tabindex is also what makes the links reachable at all in
// Safari, which skips links in the tab order by default.
const RowTabIndexContext = createContext<0 | -1>(0);

/**
 * The tabindex every focusable control inside a row must carry.
 *
 * `RowLink` applies this itself, but anything else a cell renders (a copy
 * button, a menu trigger, …) has to opt in too — otherwise each rendered row
 * adds a tab stop and the grid stops being a single one.
 */
export const useRowTabIndex = (): 0 | -1 => useContext(RowTabIndexContext);

// Row link: a TanStack Router link whose `::after` is stretched over the whole
// row (see the CSS), turning the entire row into a single hit area.
const RowLinkAnchor = forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<"a">
>(function RowLinkAnchor({ className, children, ...props }, ref) {
  const tabIndex = useRowTabIndex();
  return (
    <a
      ref={ref}
      tabIndex={tabIndex}
      className={cx(styles["row-link"], className)}
      {...props}
    >
      {children}
    </a>
  );
});

const RouterRowLink = createLink(RowLinkAnchor);

const mobileMediaQuery = "(width <= 768px)";
const subscribeToMobileViewport = (callback: () => void): (() => void) => {
  const list = globalThis.window.matchMedia(mobileMediaQuery);
  list.addEventListener("change", callback);
  return () => list.removeEventListener("change", callback);
};
const useIsMobileViewport = (): boolean =>
  useSyncExternalStore(
    subscribeToMobileViewport,
    () => globalThis.window.matchMedia(mobileMediaQuery).matches,
  );

// On mobile viewports the detail view opens as a full page instead of a side
// panel, so navigating from a row resets the scroll position there; on wider
// viewports the consumer's `resetScroll` applies (usually `false`, keeping the
// list where it is).
export const RowLink: LinkComponent<typeof RowLinkAnchor> = (props) => {
  const isMobile = useIsMobileViewport();
  // The cast is needed because the generic `LinkComponent` call signature
  // cannot re-unify once a prop is programmatically overridden; the runtime
  // shape is unchanged.
  const overridden = {
    ...props,
    resetScroll: isMobile ? true : props.resetScroll,
  } as typeof props;
  return <RouterRowLink {...overridden} />;
};

// The v9 `Table`/`Header`/`Cell` types are invariant in `TFeatures`, so these
// components are generic over the consumer's feature set instead of `any`.
function ListHeaderCell<
  TFeatures extends TableFeatures,
  TData extends RowData,
>({ header }: { header: THeader<TFeatures, TData> }) {
  return (
    <div role="columnheader" className={styles["header-cell"]}>
      <span className={styles["header-label"]}>
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
      </span>
    </div>
  );
}

function ListCell<TFeatures extends TableFeatures, TData extends RowData>({
  cell,
}: {
  cell: Cell<TFeatures, TData>;
}) {
  return (
    <div role="gridcell" className={styles["cell"]}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </div>
  );
}

interface ListProps<
  TFeatures extends TableFeatures,
  TData extends RowData,
> extends Omit<React.ComponentProps<"div">, "children"> {
  /** The table instance whose rows are rendered */
  table: Table<TFeatures, TData>;
  /** Total row count server-side, for aria-rowcount; omit if unknown */
  totalCount?: number;
  /** When true, a loading tail row is rendered after the last data row */
  hasNextPage?: boolean;
  /** Called as the last rows come into view */
  fetchNextPage?: () => void;
  /** True while a page is in flight; suppresses further fetches */
  isFetching?: boolean;
}

export function List<TFeatures extends TableFeatures, TData extends RowData>({
  table,
  totalCount,
  hasNextPage,
  fetchNextPage,
  isFetching,
  className,
  ...props
}: ListProps<TFeatures, TData>) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const titleId = useContext(TitleIdContext);
  const { rows } = table.getRowModel();
  const columns = table.getAllLeafColumns();

  const gridTemplate = columns
    .map((column) => gridTrack(metaWidth(column.columnDef.meta)))
    .join(" ");
  const minInlineSize = columns.reduce(
    (total, column) => total + trackMinWidth(metaWidth(column.columnDef.meta)),
    0,
  );

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length + (hasNextPage ? 1 : 0),
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
      // oxlint-disable-next-line react/refs
      (bodyRef.current?.getBoundingClientRect().top ?? 0) +
      globalThis.window.scrollY,
  });

  // Prevent the compiler from optimizing it
  // See https://github.com/TanStack/virtual/issues/743
  const rowVirtualizerRef = useRef(rowVirtualizer);

  // oxlint-disable-next-line react/refs
  const virtualItems = rowVirtualizerRef.current.getVirtualItems();
  // oxlint-disable-next-line react/refs
  const scrollMargin = rowVirtualizerRef.current.options.scrollMargin;

  // Roving tabindex: only one row is tabbable so the grid is a single tab
  // stop. The last focused row stays the tab stop; if it is scrolled out of
  // the virtual window, the first mounted row takes over.
  const [lastFocusedRow, setLastFocusedRow] = useState(0);
  const mountedRows = virtualItems.filter((item) => item.index < rows.length);
  const tabbableRow = mountedRows.some((item) => item.index === lastFocusedRow)
    ? lastFocusedRow
    : (mountedRows[0]?.index ?? 0);

  const focusRowLink = (index: number): boolean => {
    const link = bodyRef.current?.querySelector<HTMLElement>(
      `[data-index="${index}"] .${styles["row-link"]}`,
    );
    link?.focus();
    return Boolean(link);
  };

  // Keyboard navigation between rows: ArrowUp/ArrowDown move by one row,
  // PageUp/PageDown by ten, and (Ctrl+)Home/End jump to the first/last loaded
  // row. The APG grid pattern reserves bare Home/End for the first/last cell
  // *within* a row; with a single focusable per row that would be a no-op, so
  // they are aliased to the Ctrl variants here.
  const onRowsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (rows.length === 0) return;

    // Never steal keys from a control inside a cell — a copy button or an
    // input has its own use for Home/End.
    const focused = event.target as HTMLElement;
    if (!focused.classList.contains(styles["row-link"] ?? "")) return;

    const currentRow = focused.closest<HTMLElement>("[data-index]");
    const currentIndex = currentRow
      ? Number(currentRow.dataset["index"])
      : undefined;

    let target: number | undefined;
    switch (event.key) {
      case "ArrowDown": {
        if (currentIndex !== undefined)
          target = Math.min(currentIndex + 1, rows.length - 1);
        break;
      }
      case "ArrowUp": {
        if (currentIndex !== undefined) target = Math.max(currentIndex - 1, 0);
        break;
      }
      case "PageDown": {
        if (currentIndex !== undefined)
          target = Math.min(currentIndex + 10, rows.length - 1);
        break;
      }
      case "PageUp": {
        if (currentIndex !== undefined) target = Math.max(currentIndex - 10, 0);
        break;
      }
      case "Home": {
        target = 0;
        break;
      }
      case "End": {
        target = rows.length - 1;
        break;
      }
      default: {
        return;
      }
    }
    if (target === undefined) return;

    event.preventDefault();
    if (target === currentIndex) return;
    setLastFocusedRow(target);

    // A far-away target may not be mounted yet; scroll it into the virtual
    // window and focus it once it has rendered.
    if (!focusRowLink(target)) {
      rowVirtualizerRef.current.scrollToIndex(target);
      requestAnimationFrame(() => {
        if (!focusRowLink(target)) {
          requestAnimationFrame(() => focusRowLink(target));
        }
      });
    }
  };

  // Keep the roving tab stop on the row that last had focus, whether it got
  // it from the keyboard, a click, or tabbing back into the table.
  const onRowsFocusCapture = (
    event: React.FocusEvent<HTMLDivElement>,
  ): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-index]",
    );
    if (row) setLastFocusedRow(Number(row.dataset["index"]));
  };

  useEffect(() => {
    const lastVirtualItem = virtualItems.at(-1);
    if (!lastVirtualItem || !fetchNextPage || !hasNextPage || isFetching)
      return;

    // Start fetching the next page if we're close to the bottom
    if (lastVirtualItem.index > rows.length - 50) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetching, fetchNextPage, virtualItems, rows]);

  return (
    <div className={cx(styles["list"], className)} {...props}>
      {/* `grid` rather than `table`: the rows maintain a selection state and
          the widget provides its own arrow-key navigation, which ARIA 1.2
          says a non-interactive `table` must not do. */}
      <div
        role="grid"
        aria-labelledby={titleId}
        className={styles["table"]}
        // -1, not 0: the grid's tab stop is the tabbable row (see the roving
        // tabindex above), the container itself must not be one.
        tabIndex={-1}
        onKeyDown={onRowsKeyDown}
        onFocusCapture={onRowsFocusCapture}
        aria-rowcount={
          // -1 is the ARIA encoding for "total count unknown"; once the last
          // page is loaded, the loaded rows are the total.
          totalCount === undefined
            ? hasNextPage
              ? -1
              : rows.length + 1
            : totalCount + 1
        }
        aria-colcount={columns.length}
        style={
          {
            "--data-table-grid-template": gridTemplate,
            minInlineSize: `${minInlineSize}px`,
          } as React.CSSProperties
        }
      >
        <div role="rowgroup">
          {table.getHeaderGroups().map((headerGroup) => (
            <div
              role="row"
              key={headerGroup.id}
              aria-rowindex={1}
              className={styles["header-row"]}
            >
              {headerGroup.headers.map((header) => (
                <ListHeaderCell key={header.id} header={header} />
              ))}
            </div>
          ))}
        </div>

        {/* An empty rowgroup is non-conforming (`row` is a required owned
            element), so the role is dropped while there is nothing to own. */}
        <div
          role={rows.length > 0 || hasNextPage ? "rowgroup" : undefined}
          ref={bodyRef}
          className={styles["body"]}
          style={{
            // oxlint-disable-next-line react/refs
            blockSize: `${rowVirtualizerRef.current.getTotalSize()}px`,
          }}
        >
          {/* oxlint-disable-next-line react/refs */}
          {virtualItems.map((virtualRow) => {
            // Rounded to keep the rows on whole-pixel boundaries — the
            // scrollMargin comes from getBoundingClientRect() and is usually
            // fractional, which would blur borders and focus rings.
            const transform = `translateY(${Math.round(virtualRow.start - scrollMargin)}px)`;

            if (hasNextPage && virtualRow.index >= rows.length) {
              return (
                <div
                  role="row"
                  key="__loading__"
                  className={cx(styles["row"], styles["loading-row"])}
                  aria-rowindex={rows.length + 2}
                  aria-busy="true"
                  style={{ blockSize: `${virtualRow.size}px`, transform }}
                >
                  <div
                    role="gridcell"
                    aria-colspan={columns.length}
                    className={styles["loading-cell"]}
                  >
                    <InlineSpinner />
                    <FormattedMessage
                      id="ui.data_table.loading_more"
                      defaultMessage="Loading more…"
                      description="Label shown in a table row while the next page of results is being loaded"
                    />
                  </div>
                </div>
              );
            }

            const row = rows[virtualRow.index];
            if (!row)
              throw new Error("got a virtual row for a non-existing row");

            return (
              <RowTabIndexContext.Provider
                key={row.id}
                value={virtualRow.index === tabbableRow ? 0 : -1}
              >
                <div
                  role="row"
                  data-index={virtualRow.index}
                  className={styles["row"]}
                  aria-rowindex={virtualRow.index + 2}
                  style={{ blockSize: `${virtualRow.size}px`, transform }}
                >
                  {row.getAllCells().map((cell) => (
                    <ListCell key={cell.id} cell={cell} />
                  ))}
                </div>
              </RowTabIndexContext.Provider>
            );
          })}
        </div>
      </div>
    </div>
  );
}
