// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  autoUpdate,
  FloatingFocusManager,
  size,
  useFloating,
  useFocus,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button, Form } from "@vector-im/compound-web";
import { useCallback, useId, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import styles from "./picker.module.css";

interface ComboboxProps<T> {
  items: T[];
  itemKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  isItemDisabled?: (item: T) => boolean;
  onSelect: (item: T) => void;
  search: string;
  onSearchChange: (search: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  /** Shown in the list when nothing matches the search. */
  noMatchHelp: React.ReactNode;
}

/**
 * A search input with a floating list of choices, which keeps the focus on the
 * input while the arrow keys move through the list.
 */
export function Combobox<T>({
  items,
  itemKey,
  renderItem,
  isItemDisabled,
  onSelect,
  search,
  onSearchChange,
  isLoading = false,
  placeholder,
  noMatchHelp,
}: ComboboxProps<T>) {
  // Tracks the active/hovered index in the list
  const [activeIndex, setActiveIndex] = useState<null | number>(null);

  const listRef = useRef<(HTMLElement | null)[]>([]);
  const [showList, setShowList] = useState(false);
  const { refs, floatingStyles, context } = useFloating<HTMLInputElement>({
    open: showList,
    onOpenChange: setShowList,
    // Makes sure to update the sizing/positioning when the window is resizing,
    // which is especially important on mobile
    whileElementsMounted: autoUpdate,
    middleware: [
      size({
        // Gives a bit of padding with the bottom of the screen
        padding: 16,
        apply({ rects, elements, availableHeight }) {
          // Inject a few CSS variables to get the sizing right
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
    ],
  });

  // This gives the right aria roles to the input and the list items
  const role = useRole(context, { role: "combobox" });
  // This gives the keyboard list navigation behaviour
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex: activeIndex,
    onNavigate: setActiveIndex,
    // This keeps the focus on the text input rather than on the items
    virtual: true,
  });
  // This opens/closes the list when focusing the input
  const focus = useFocus(context);

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [role, listNav, focus],
  );

  const onSearchInput = useCallback(
    (event: React.InputEvent<HTMLInputElement>) => {
      event.preventDefault();
      onSearchChange(event.currentTarget.value);
      // Reset active index when searching
      setActiveIndex(null);
    },
    [onSearchChange],
  );

  // Select the current active item when pressing enter
  const onSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const activeItem =
        activeIndex !== null && !isLoading && items[activeIndex];
      if (
        event.key === "Enter" &&
        activeItem &&
        !isItemDisabled?.(activeItem)
      ) {
        event.preventDefault();
        onSelect(activeItem);
      }
    },
    [activeIndex, isLoading, items, isItemDisabled, onSelect],
  );

  const itemIdPrefix = useId();

  return (
    <>
      <Form.TextControl
        ref={(node) => {
          refs.setReference(node);
        }}
        value={search}
        required
        placeholder={placeholder}
        aria-autocomplete="list"
        className={styles["reference"]}
        {...getReferenceProps({
          onInput: onSearchInput,
          onKeyDown: onSearchKeyDown,
        })}
      />
      {showList && (
        <FloatingFocusManager
          context={context}
          initialFocus={-1}
          visuallyHiddenDismiss
        >
          <div
            ref={(node) => {
              refs.setFloating(node);
            }}
            style={floatingStyles}
            className={styles["floating"]}
            {...getFloatingProps()}
          >
            {items.length === 0 ? (
              isLoading ? (
                <div className={styles["loading"]}>
                  <FormattedMessage
                    id="ui.user_picker.loading_list"
                    description="On the user-picker list, this is the placeholder shown whilst things are loading"
                    defaultMessage="Loading…"
                  />
                </div>
              ) : (
                <div className={styles["no-match"]}>
                  <div className={styles["headline"]}>
                    <FormattedMessage
                      id="ui.user_picker.no_match"
                      description="On the user-picker list, this is the placeholder shown when there are no results"
                      defaultMessage="No match"
                    />
                  </div>
                  <div className={styles["help"]}>{noMatchHelp}</div>
                </div>
              )
            ) : (
              <ul className={styles["list"]} aria-busy={isLoading}>
                {items.map((item, index) => {
                  const disabled = isItemDisabled?.(item) ?? false;
                  return (
                    <li
                      key={itemKey(item)}
                      ref={(node) => {
                        listRef.current[index] = node;
                      }}
                      {...getItemProps({
                        id: `${itemIdPrefix}-${itemKey(item)}`,
                        onClick(event: React.MouseEvent<HTMLLIElement>) {
                          event.preventDefault();
                          if (!disabled) onSelect(item);
                        },
                        active: index === activeIndex,
                        "aria-disabled": disabled || undefined,
                      })}
                      className={styles["item"]}
                      data-active={index === activeIndex}
                      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                      tabIndex={index === activeIndex ? 0 : -1}
                    >
                      {renderItem(item)}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </FloatingFocusManager>
      )}
    </>
  );
}

/**
 * The chosen item, which replaces the search input, with a button to clear
 * the choice. The value goes to the form through a hidden input.
 */
export const ComboboxSelection = ({
  value,
  onClear,
  action,
  children,
}: React.PropsWithChildren<{
  value: string;
  onClear: () => void;
  /** A button shown before the clear button, such as a link to the item. */
  action?: React.ReactNode;
}>) => {
  const intl = useIntl();
  return (
    <div className={styles["selected"]}>
      <Form.TextControl type="hidden" value={value} />
      <div className={styles["chip"]}>{children}</div>
      {action}
      <Button
        iconOnly
        Icon={CloseIcon}
        kind="secondary"
        aria-label={intl.formatMessage({
          id: "ui.user_picker.clear",
          defaultMessage: "Clear selection",
          description:
            "Accessible name of the button which clears the chosen user or room in a picker",
        })}
        onClick={onClear}
      />
    </div>
  );
};
