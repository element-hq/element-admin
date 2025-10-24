// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
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
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Avatar, Button, Form } from "@vector-im/compound-web";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { FormattedMessage } from "react-intl";

import { usersInfiniteQuery } from "@/api/mas";
import type { SingleResourceForUser } from "@/api/mas/api";
import { mediaThumbnailQuery, profileQuery } from "@/api/matrix";
import { useImageBlob } from "@/utils/blob";

import styles from "./user-picker.module.css";

const UserChipContent = ({
  synapseRoot,
  mxid,
}: {
  synapseRoot: string;
  mxid: string;
}) => {
  const { data: profileData } = useQuery(profileQuery(synapseRoot, mxid));
  const { data: avatarBlob } = useQuery(
    mediaThumbnailQuery(synapseRoot, profileData?.avatar_url ?? undefined),
  );
  const avatar = useImageBlob(avatarBlob);
  const displayName = profileData?.displayname;
  return (
    <>
      <Avatar id={mxid} name={displayName || mxid} src={avatar} size="32px" />
      <div className={styles["user-infos"]}>
        {displayName ? (
          <>
            <div className={styles["primary"]}>{displayName}</div>
            <div className={styles["secondary"]}>{mxid}</div>
          </>
        ) : (
          <div className={styles["primary"]}>{mxid}</div>
        )}
      </div>
    </>
  );
};

// This is a bit of a hack to remove the leading `@` as well as any trailing
// domain name from the search term, so that looking by full MXID works
const normalizeSearch = (term: string): string =>
  term.trim().replace(/^@/, "").replace(/:.*$/, "").toLocaleLowerCase();

export const UserPicker = ({
  serverName,
  synapseRoot,
}: {
  serverName: string;
  synapseRoot: string;
}) => {
  // Tracks the selected user
  const [selectedUser, setSelectedUser] =
    useState<null | SingleResourceForUser>(null);
  // Tracks the active/hovered index in the list
  const [activeIndex, setActiveIndex] = useState<null | number>(null);

  // This state is in-sync with the input, and the debounced one is the one kicking off the query
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, { state }] = useDebouncedValue(
    normalizeSearch(userSearch),
    { wait: 200 },
    ({ isPending }) => ({ isPending }),
  );

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

  const { data, isPlaceholderData } = useInfiniteQuery({
    ...usersInfiniteQuery(serverName, {
      search: debouncedUserSearch,
    }),
    placeholderData: (previous) => previous,
  });

  const isLoading = state.isPending || isPlaceholderData;

  const users = useMemo(
    () =>
      data?.pages
        ?.flatMap((page) => page.data)
        .filter(
          // Apply a local filter on the data we have for instant feedback
          (user) =>
            user.attributes.deactivated_at === null &&
            user.attributes.username
              .toLocaleLowerCase()
              .includes(normalizeSearch(userSearch)),
        ) ?? [],
    [data, userSearch],
  );

  const onSearchInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      event.preventDefault();
      const newValue = event.currentTarget.value;
      setUserSearch(newValue);
      // Reset active index when searching
      setActiveIndex(null);
    },
    [],
  );

  // Select the current active item when pressing enter
  const onSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const activeUser =
        activeIndex !== null && !isLoading && users[activeIndex];
      if (event.key === "Enter" && activeUser) {
        event.preventDefault();
        setSelectedUser(activeUser);
      }
    },
    [activeIndex, isLoading, users],
  );

  const onClearSelection = useCallback(() => {
    setShowList(false);
    setUserSearch("");
    setSelectedUser(null);
  }, []);

  const itemIdPrefix = useId();

  if (selectedUser) {
    return (
      <div className={styles["selected-user"]}>
        <Form.TextControl type="hidden" value={selectedUser.id} />
        <div className={styles["user-chip"]}>
          <UserChipContent
            synapseRoot={synapseRoot}
            mxid={`@${selectedUser.attributes.username}:${serverName}`}
          />
        </div>
        <Button
          iconOnly
          Icon={CloseIcon}
          kind="secondary"
          onClick={onClearSelection}
        />
      </div>
    );
  }

  return (
    <>
      <Form.TextControl
        ref={(node) => {
          refs.setReference(node);
        }}
        value={userSearch}
        required
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
            {users.length === 0 ? (
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
                  <div className={styles["help"]}>
                    <FormattedMessage
                      id="ui.user_picker.no_match_help"
                      description="On the user-picker list, this is the help text shown when there are no results"
                      defaultMessage="Try a different search term. This can only lookup active users on {serverName} using their localpart."
                      values={{
                        serverName,
                      }}
                    />
                  </div>
                </div>
              )
            ) : (
              <ul className={styles["list"]} aria-busy={isLoading}>
                {users.map((user, index) => (
                  <li
                    key={user.id}
                    ref={(node) => {
                      listRef.current[index] = node;
                    }}
                    {...getItemProps({
                      id: `${itemIdPrefix}-${user.id}`,
                      onClick(event: React.MouseEvent<HTMLLIElement>) {
                        event.preventDefault();
                        setSelectedUser(user);
                      },
                      active: index === activeIndex,
                    })}
                    className={styles["item"]}
                    data-active={index === activeIndex}
                    tabIndex={index === activeIndex ? 0 : -1}
                  >
                    <UserChipContent
                      synapseRoot={synapseRoot}
                      mxid={`@${user.attributes.username}:${serverName}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FloatingFocusManager>
      )}
    </>
  );
};
