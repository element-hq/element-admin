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
import {
  ArrowRightIcon,
  CloseIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Avatar, Button, Form } from "@vector-im/compound-web";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import type { ServerAnnouncementRoom } from "@/api/synapse";
import { ButtonLink } from "@/components/link";
import * as Picker from "@/components/picker";
import { RoomAvatar } from "@/components/room-info";

// A configured room which no longer exists, and which cannot be chosen
const isDeleted = (room: ServerAnnouncementRoom): boolean =>
  room.room_id === null;

const RoomChipContent = ({
  synapseRoot,
  room,
}: {
  synapseRoot: string;
  room: ServerAnnouncementRoom;
}) => (
  <>
    {room.room_id === null ? (
      <Avatar id={room.id} name={room.room_name} size="32px" />
    ) : (
      <RoomAvatar
        synapseRoot={synapseRoot}
        roomId={room.room_id}
        roomName={room.room_name}
        roomCanonicalAlias={null}
        roomType={null}
        members={0}
        size="32px"
      />
    )}
    <Picker.Infos>
      <Picker.Primary>
        {room.room_id === null ? (
          <FormattedMessage
            id="ui.room_picker.deleted_room"
            defaultMessage="{name} (deleted)"
            description="In the announcement room picker, the name of a configured room which was deleted and cannot be chosen"
            values={{ name: room.room_name }}
          />
        ) : (
          room.room_name
        )}
      </Picker.Primary>
      <Picker.Secondary>{room.id}</Picker.Secondary>
    </Picker.Infos>
  </>
);

/** Picks one of the configured announcement rooms, searched by name or id. */
export const RoomPicker = ({
  synapseRoot,
  rooms,
  value,
  onChange,
}: {
  synapseRoot: string;
  rooms: ServerAnnouncementRoom[];
  value: ServerAnnouncementRoom | null;
  onChange: (room: ServerAnnouncementRoom | null) => void;
}) => {
  const intl = useIntl();
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rooms.filter(
      (room) =>
        room.room_name.toLocaleLowerCase().includes(term) ||
        room.id.toLocaleLowerCase().includes(term),
    );
  }, [rooms, search]);

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
      setSearch(event.currentTarget.value);
      // Reset active index when searching
      setActiveIndex(null);
    },
    [],
  );

  // Select the current active room when pressing enter
  const onSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const activeRoom = activeIndex !== null && matches[activeIndex];
      if (event.key === "Enter" && activeRoom && !isDeleted(activeRoom)) {
        event.preventDefault();
        onChange(activeRoom);
      }
    },
    [activeIndex, matches, onChange],
  );

  const onClear = useCallback(() => {
    setSearch("");
    onChange(null);
  }, [onChange]);

  const itemIdPrefix = useId();

  if (value) {
    return (
      <Picker.Selection>
        <Form.TextControl type="hidden" value={value.id} />
        <Picker.Chip>
          <RoomChipContent synapseRoot={synapseRoot} room={value} />
        </Picker.Chip>
        {value.room_id !== null && (
          <ButtonLink
            iconOnly
            Icon={ArrowRightIcon}
            kind="secondary"
            to="/rooms/$roomId"
            params={{ roomId: value.room_id }}
            aria-label={intl.formatMessage({
              id: "ui.room_picker.view",
              defaultMessage: "View",
              description:
                "Accessible name of the button next to the chosen announcement room which opens its details",
            })}
          />
        )}
        <Button
          iconOnly
          Icon={CloseIcon}
          kind="secondary"
          aria-label={intl.formatMessage({
            id: "ui.room_picker.clear",
            defaultMessage: "Clear selection",
            description:
              "Accessible name of the button which clears the chosen room in the announcement room picker",
          })}
          onClick={onClear}
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
        value={search}
        required
        placeholder={intl.formatMessage({
          id: "ui.room_picker.placeholder",
          defaultMessage: "Search announcement rooms…",
          description:
            "Placeholder of the search input of the announcement room picker",
        })}
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
            {matches.length === 0 ? (
              <Picker.Empty>
                <Picker.EmptyTitle>
                  <FormattedMessage
                    id="ui.room_picker.no_match"
                    defaultMessage="No match"
                    description="On the announcement room picker list, the headline shown when no room matches the search"
                  />
                </Picker.EmptyTitle>
                <Picker.EmptyHelp>
                  <FormattedMessage
                    id="ui.room_picker.no_match_help"
                    defaultMessage="Try a different search term. Only the announcement rooms configured in Synapse are listed."
                    description="On the announcement room picker list, the help text shown when no room matches the search"
                  />
                </Picker.EmptyHelp>
              </Picker.Empty>
            ) : (
              <Picker.List>
                {matches.map((room, index) => {
                  const disabled = isDeleted(room);
                  return (
                    <Picker.Item
                      key={room.id}
                      ref={(node) => {
                        listRef.current[index] = node;
                      }}
                      active={index === activeIndex}
                      disabled={disabled}
                      {...getItemProps({
                        id: `${itemIdPrefix}-${room.id}`,
                        onClick(event: React.MouseEvent<HTMLLIElement>) {
                          event.preventDefault();
                          if (!disabled) onChange(room);
                        },
                        active: index === activeIndex,
                      })}
                    >
                      <RoomChipContent synapseRoot={synapseRoot} room={room} />
                    </Picker.Item>
                  );
                })}
              </Picker.List>
            )}
          </Picker.Floating>
        </FloatingFocusManager>
      )}
    </>
  );
};
