// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  autoUpdate,
  FloatingFocusManager,
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
import { FormattedMessage, useIntl } from "react-intl";

import { usersInfiniteQuery } from "@/api/mas";
import type { SingleResourceForUser } from "@/api/mas/api";
import { mediaThumbnailQuery, profileQuery } from "@/api/matrix";
import * as Picker from "@/components/picker";
import { useImageBlob } from "@/utils/blob";

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
      <Picker.Infos>
        {displayName ? (
          <>
            <Picker.Primary>{displayName}</Picker.Primary>
            <Picker.Secondary>{mxid}</Picker.Secondary>
          </>
        ) : (
          <Picker.Primary>{mxid}</Picker.Primary>
        )}
      </Picker.Infos>
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
  const intl = useIntl();
  // Tracks the selected user
  const [selectedUser, setSelectedUser] =
    useState<null | SingleResourceForUser>(null);

  // This state is in-sync with the input, and the debounced one is the one kicking off the query
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, { state }] = useDebouncedValue(
    normalizeSearch(userSearch),
    { key: "user-picker", wait: 200 },
    ({ isPending }) => ({ isPending }),
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
    middleware: Picker.floatingMiddleware,
  });

  // This gives the right aria roles to the input and the list items
  const role = useRole(context, { role: "combobox" });
  // This gives the keyboard list navigation behaviour
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex,
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
      setUserSearch(event.currentTarget.value);
      // Reset active index when searching
      setActiveIndex(null);
    },
    [],
  );

  // Select the current active user when pressing enter, unless the list may
  // not match the search yet
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
    setUserSearch("");
    setSelectedUser(null);
  }, []);

  const itemIdPrefix = useId();

  if (selectedUser) {
    return (
      <Picker.Selection>
        <Form.TextControl type="hidden" value={selectedUser.id} />
        <Picker.Chip>
          <UserChipContent
            synapseRoot={synapseRoot}
            mxid={`@${selectedUser.attributes.username}:${serverName}`}
          />
        </Picker.Chip>
        <Button
          iconOnly
          Icon={CloseIcon}
          kind="secondary"
          aria-label={intl.formatMessage({
            id: "ui.user_picker.clear",
            defaultMessage: "Clear selection",
            description:
              "Accessible name of the button which clears the chosen user in the user picker",
          })}
          onClick={onClearSelection}
        />
      </Picker.Selection>
    );
  }

  return (
    <>
      <Picker.Input
        ref={(node) => {
          refs.setReference(node);
        }}
        value={userSearch}
        required
        aria-autocomplete="list"
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
          <Picker.Floating
            ref={(node) => {
              refs.setFloating(node);
            }}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {users.length === 0 ? (
              isLoading ? (
                <Picker.Loading>
                  <FormattedMessage
                    id="ui.user_picker.loading_list"
                    description="On the user-picker list, this is the placeholder shown whilst things are loading"
                    defaultMessage="Loading…"
                  />
                </Picker.Loading>
              ) : (
                <Picker.Empty>
                  <Picker.EmptyTitle>
                    <FormattedMessage
                      id="ui.user_picker.no_match"
                      description="On the user-picker list, this is the placeholder shown when there are no results"
                      defaultMessage="No match"
                    />
                  </Picker.EmptyTitle>
                  <Picker.EmptyHelp>
                    <FormattedMessage
                      id="ui.user_picker.no_match_help"
                      description="On the user-picker list, this is the help text shown when there are no results"
                      defaultMessage="Try a different search term. This can only lookup active users on {serverName} using their localpart."
                      values={{
                        serverName,
                      }}
                    />
                  </Picker.EmptyHelp>
                </Picker.Empty>
              )
            ) : (
              <Picker.List busy={isLoading}>
                {users.map((user, index) => (
                  <Picker.Item
                    key={user.id}
                    ref={(node) => {
                      listRef.current[index] = node;
                    }}
                    active={index === activeIndex}
                    {...getItemProps({
                      id: `${itemIdPrefix}-${user.id}`,
                      onClick(event: React.MouseEvent<HTMLLIElement>) {
                        event.preventDefault();
                        setSelectedUser(user);
                      },
                      active: index === activeIndex,
                    })}
                  >
                    <UserChipContent
                      synapseRoot={synapseRoot}
                      mxid={`@${user.attributes.username}:${serverName}`}
                    />
                  </Picker.Item>
                ))}
              </Picker.List>
            )}
          </Picker.Floating>
        </FloatingFocusManager>
      )}
    </>
  );
};
