// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useDebouncedValue } from "@tanstack/react-pacer";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowRightIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Avatar } from "@vector-im/compound-web";
import { useCallback, useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { usersInfiniteQuery } from "@/api/mas";
import type { SingleResourceForUser } from "@/api/mas/api";
import { mediaThumbnailQuery, profileQuery } from "@/api/matrix";
import { ButtonLink } from "@/components/link";
import { useImageBlob } from "@/utils/blob";

import { Combobox, ComboboxSelection } from "./combobox";
import styles from "./picker.module.css";

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
      <div className={styles["infos"]}>
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
  defaultUser = null,
  onChange,
}: {
  serverName: string;
  synapseRoot: string;
  defaultUser?: SingleResourceForUser | null;
  onChange?: (user: SingleResourceForUser | null) => void;
}) => {
  const intl = useIntl();
  // Tracks the selected user
  const [selectedUser, setSelectedUserState] =
    useState<null | SingleResourceForUser>(defaultUser);
  const setSelectedUser = useCallback(
    (user: SingleResourceForUser | null) => {
      setSelectedUserState(user);
      onChange?.(user);
    },
    [onChange],
  );

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

  const onClearSelection = useCallback(() => {
    setUserSearch("");
    setSelectedUser(null);
  }, [setSelectedUser]);

  if (selectedUser) {
    return (
      <ComboboxSelection
        value={selectedUser.id}
        onClear={onClearSelection}
        action={
          <ButtonLink
            iconOnly
            Icon={ArrowRightIcon}
            kind="secondary"
            to="/users/$userId"
            params={{ userId: selectedUser.id }}
            aria-label={intl.formatMessage({
              id: "ui.user_picker.view",
              defaultMessage: "View",
              description:
                "Accessible name of the button next to the chosen user which opens their details",
            })}
          />
        }
      >
        <UserChipContent
          synapseRoot={synapseRoot}
          mxid={`@${selectedUser.attributes.username}:${serverName}`}
        />
      </ComboboxSelection>
    );
  }

  return (
    <Combobox
      items={users}
      itemKey={(user) => user.id}
      renderItem={(user) => (
        <UserChipContent
          synapseRoot={synapseRoot}
          mxid={`@${user.attributes.username}:${serverName}`}
        />
      )}
      onSelect={setSelectedUser}
      search={userSearch}
      onSearchChange={setUserSearch}
      isLoading={isLoading}
      noMatchHelp={
        <FormattedMessage
          id="ui.user_picker.no_match_help"
          description="On the user-picker list, this is the help text shown when there are no results"
          defaultMessage="Try a different search term. This can only lookup active users on {serverName} using their localpart."
          values={{
            serverName,
          }}
        />
      }
    />
  );
};
