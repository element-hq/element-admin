// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { ArrowRightIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Avatar } from "@vector-im/compound-web";
import { useCallback, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import type { ServerAnnouncementRoom } from "@/api/synapse";
import { ButtonLink } from "@/components/link";
import { RoomAvatar } from "@/components/room-info";

import { Combobox, ComboboxSelection } from "./combobox";
import styles from "./picker.module.css";

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
    <div className={styles["infos"]}>
      <div className={styles["primary"]}>
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
      </div>
      <div className={styles["secondary"]}>{room.id}</div>
    </div>
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

  const onClear = useCallback(() => {
    setSearch("");
    onChange(null);
  }, [onChange]);

  if (value) {
    return (
      <ComboboxSelection
        value={value.id}
        onClear={onClear}
        action={
          value.room_id !== null && (
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
          )
        }
      >
        <RoomChipContent synapseRoot={synapseRoot} room={value} />
      </ComboboxSelection>
    );
  }

  return (
    <Combobox
      items={matches}
      itemKey={(room) => room.id}
      renderItem={(room) => (
        <RoomChipContent synapseRoot={synapseRoot} room={room} />
      )}
      isItemDisabled={(room) => room.room_id === null}
      onSelect={onChange}
      search={search}
      onSearchChange={setSearch}
      placeholder={intl.formatMessage({
        id: "ui.room_picker.placeholder",
        defaultMessage: "Search announcement rooms…",
        description:
          "Placeholder of the search input of the announcement room picker",
      })}
      noMatchHelp={
        <FormattedMessage
          id="ui.room_picker.no_match_help"
          defaultMessage="Try a different search term. Only the announcement rooms configured in Synapse are listed."
          description="On the announcement room picker list, the help text shown when no room matches the search"
        />
      }
    />
  );
};
