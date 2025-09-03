import { useQueries, useQuery } from "@tanstack/react-query";
import { Avatar, AvatarStack } from "@vector-im/compound-web";
import { useIntl } from "react-intl";

import { profileQuery, mediaThumbnailQuery } from "@/api/matrix";
import { roomDetailQuery, roomMembersQuery } from "@/api/synapse";
import { useImageBlob } from "@/utils/blob";

const useUserAvatar = (
  synapseRoot: string,
  userId: string,
): string | undefined => {
  const { data: profile } = useQuery(profileQuery(synapseRoot, userId));
  const { data: avatarBlob } = useQuery(
    mediaThumbnailQuery(synapseRoot, profile?.avatar_url),
  );
  return useImageBlob(avatarBlob);
};

const useUserDisplayName = (
  synapseRoot: string,
  userId: string,
): string | undefined => {
  const { data: profile } = useQuery(profileQuery(synapseRoot, userId));
  return profile?.displayname;
};

const useRoomAvatar = (
  synapseRoot: string,
  roomId: string,
): string | undefined => {
  const { data: details } = useQuery(roomDetailQuery(synapseRoot, roomId));
  const { data: avatarBlob } = useQuery(
    mediaThumbnailQuery(synapseRoot, details?.avatar || undefined),
  );
  return useImageBlob(avatarBlob);
};

const useRoomName = (
  roomName: string | null,
  roomType: string | null,
  membersCount: number,
  synapseRoot: string,
  roomId: string,
): string => {
  const intl = useIntl();
  const { data: members } = useQuery({
    ...roomMembersQuery(synapseRoot, roomId),
    initialData: {
      members: [],
      total: membersCount,
    },
    enabled: !roomName,
  });
  const fallbackDisplayName = intl.formatMessage({
    id: "room_info.unknown_user",
    defaultMessage: "Unknown user",
    description:
      "When showing the room name based on members, this is the fallback when we can't load the member name for some reason",
  });

  // We load the profile of up to the first 3 members
  const heroes = [...members.members].sort().splice(0, 3);
  const heroesDisplayNames = useQueries({
    queries: heroes.map((userId) => profileQuery(synapseRoot, userId)),
    combine: (results): string[] =>
      Array.from({ length: Math.min(members.total || 0, 3) }).map(
        (_, index) =>
          results[index]?.data?.displayname ||
          heroes[index] ||
          fallbackDisplayName,
      ),
  });

  const isSpace = roomType === "m.space";

  if (roomName) {
    return roomName;
  }

  if (membersCount === undefined || membersCount === 0) {
    return isSpace
      ? intl.formatMessage({
          id: "room_info.empty_space",
          defaultMessage: "Empty space",
          description:
            "Name of a space when the space has no explicit name and no member",
        })
      : intl.formatMessage({
          id: "room_info.empty_room",
          defaultMessage: "Empty room",
          description:
            "Name of a room when the room has no explicit name and no member",
        });
  }

  if (membersCount === 2 && !isSpace) {
    return intl.formatList(heroesDisplayNames, {
      type: "conjunction",
      style: "narrow",
    });
  }

  let party;
  switch (membersCount) {
    case 1: {
      party = heroesDisplayNames[0] || fallbackDisplayName;
      break;
    }
    case 2:
    case 3: {
      party = intl.formatList(heroesDisplayNames, {
        type: "conjunction",
        style: "long",
      });
      break;
    }
    default: {
      const [alice, bob] = heroesDisplayNames;
      const countOthers = membersCount - 2;
      const others = intl.formatMessage(
        {
          id: "rooms_info.other_members",
          defaultMessage: "{COUNT, plural, one {# other} other {# others}}",
          description:
            "When a room or space has no name, we show 'Room/Space with Alice, Bob and 3 others'. This is the 'X others' part.",
        },
        {
          COUNT: countOthers,
        },
      );
      party = intl.formatList(
        [alice || fallbackDisplayName, bob || fallbackDisplayName, others],
        { type: "conjunction", style: "long" },
      );
    }
  }

  return isSpace
    ? intl.formatMessage(
        {
          id: "room_info.space_with",
          defaultMessage: "Space with {members}",
          description:
            "Name we display for a space with no explicit name. In this case, we show the list of members, e.g. 'Space with Alice and Bob'",
        },
        {
          members: party,
        },
      )
    : intl.formatMessage(
        {
          id: "room_info.room_with",
          defaultMessage: "Room with {members}",
          description:
            "Name we display for a room with no explicit name. In this case, we show the list of members, e.g. 'Room with Alice and Bob'",
        },
        {
          members: party,
        },
      );
};

interface RoomAvatarProps {
  synapseRoot: string;
  roomId: string;
  roomName: string | null;
  roomType: string | null;
  members: number;
  size?: string;
}
export const RoomAvatar: React.FC<RoomAvatarProps> = ({
  synapseRoot,
  roomId,
  roomName,
  roomType,
  members,
  size,
}: RoomAvatarProps) => {
  const isSpace = roomType === "m.space";
  const avatar = useRoomAvatar(synapseRoot, roomId);
  const shouldShowHeroes = members > 0 && members <= 2 && !roomName;
  const { data: membersList } = useQuery({
    ...roomMembersQuery(synapseRoot, roomId),
    initialData: {
      members: [],
      total: members,
    },
    enabled: shouldShowHeroes,
  });
  // In case we don't have a room avatar, we show up to two user avatars
  const heroes = [...membersList.members].sort().splice(0, 2);
  const displayName = useRoomName(
    roomName,
    roomType,
    members,
    synapseRoot,
    roomId,
  );
  return shouldShowHeroes && heroes.length > 0 ? (
    <AvatarStack>
      {heroes.map((mxid) => (
        <UserAvatar
          key={mxid}
          synapseRoot={synapseRoot}
          userId={mxid}
          size={`calc(${size} * 0.625)`}
        />
      ))}
    </AvatarStack>
  ) : (
    <Avatar
      id={roomId}
      src={avatar}
      name={displayName}
      type={isSpace ? "square" : "round"}
      size={size}
    />
  );
};

interface RoomDisplayNameProps {
  synapseRoot: string;
  roomId: string;
  roomName: string | null;
  roomType: string | null;
  members: number;
}
export const RoomDisplayName: React.FC<RoomDisplayNameProps> = ({
  synapseRoot,
  roomId,
  roomName,
  roomType,
  members,
}: RoomDisplayNameProps) => {
  const displayName = useRoomName(
    roomName,
    roomType,
    members,
    synapseRoot,
    roomId,
  );
  return displayName;
};

interface UserAvatarProps {
  synapseRoot: string;
  userId: string;
  size: string;
}
export const UserAvatar: React.FC<UserAvatarProps> = ({
  synapseRoot,
  userId,
  size,
}: UserAvatarProps) => {
  const avatar = useUserAvatar(synapseRoot, userId);
  const displayName = useUserDisplayName(synapseRoot, userId);
  return (
    <Avatar id={userId} src={avatar} name={displayName || userId} size={size} />
  );
};
