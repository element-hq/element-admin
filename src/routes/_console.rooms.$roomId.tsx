/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { H3, Text, Tooltip } from "@vector-im/compound-web";
import { useIntl } from "react-intl";

import { wellKnownQuery } from "@/api/matrix";
import { roomDetailQuery } from "@/api/synapse";
import * as Data from "@/components/data";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import { RoomAvatar, RoomDisplayName } from "@/components/room-info";
import * as messages from "@/messages";

export const Route = createFileRoute("/_console/rooms/$roomId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    await queryClient.ensureQueryData(
      roomDetailQuery(synapseRoot, params.roomId),
    );
  },
  component: RouteComponent,
});

const formatEncryption = (encryption: string | null) => {
  if (!encryption) return "None";
  if (encryption === "m.megolm.v1.aes-sha2") return "E2EE";
  return encryption;
};

const formatJoinRules = (joinRules: string | null) => {
  if (!joinRules) return "Unknown";
  return joinRules;
};

const formatGuestAccess = (guestAccess: string | null) => {
  if (!guestAccess) return "Unknown";
  return guestAccess === "can_join" ? "Allowed" : "Forbidden";
};

const formatHistoryVisibility = (historyVisibility: string | null) => {
  if (!historyVisibility) return "Unknown";
  switch (historyVisibility) {
    case "invited": {
      return "Invited";
    }
    case "joined": {
      return "Joined";
    }
    case "shared": {
      return "Shared";
    }
    case "world_readable": {
      return "World Readable";
    }
    default: {
      return historyVisibility;
    }
  }
};

function RouteComponent() {
  const intl = useIntl();
  const { credentials } = Route.useRouteContext();
  const { roomId } = Route.useParams();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const { data: room } = useSuspenseQuery(roomDetailQuery(synapseRoot, roomId));

  return (
    <Navigation.Details>
      <div className="flex items-center justify-end">
        <Tooltip label={intl.formatMessage(messages.actionClose)}>
          <ButtonLink
            iconOnly
            to="/rooms"
            kind="tertiary"
            size="sm"
            Icon={CloseIcon}
          />
        </Tooltip>
      </div>

      <div className="py-6 flex flex-col items-center gap-4">
        <RoomAvatar
          roomId={room.room_id}
          roomName={room.name}
          roomCanonicalAlias={room.canonical_alias}
          roomType={room.room_type}
          members={room.joined_members}
          synapseRoot={synapseRoot}
          size="64px"
        />

        <div className="flex flex-col gap-1 items-center">
          <H3>
            <RoomDisplayName
              roomId={room.room_id}
              roomName={room.name}
              roomCanonicalAlias={room.canonical_alias}
              roomType={room.room_type}
              members={room.joined_members}
              synapseRoot={synapseRoot}
            />
          </H3>
          {room.canonical_alias && (
            <Text size="md" className="text-text-primary">
              {room.canonical_alias}
            </Text>
          )}
          <Text size="md" className="text-text-secondary">
            {room.room_id}
          </Text>
          {room.topic && (
            <Text size="sm" className="text-text-secondary">
              {room.topic}
            </Text>
          )}
        </div>
      </div>

      <Data.Grid>
        <Data.Item>
          <Data.Title>Visibility</Data.Title>
          <Data.Value>{room.public ? "Public" : "Private"}</Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>Encryption</Data.Title>
          <Data.Value>{formatEncryption(room.encryption)}</Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>Join Rules</Data.Title>
          <Data.Value>{formatJoinRules(room.join_rules)}</Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>Guest Access</Data.Title>
          <Data.Value>{formatGuestAccess(room.guest_access)}</Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>History Visibility</Data.Title>
          <Data.Value>
            {formatHistoryVisibility(room.history_visibility)}
          </Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>Federatable</Data.Title>
          <Data.Value>{room.federatable ? "Yes" : "No"}</Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>Room Version</Data.Title>
          <Data.Value>{room.version}</Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>Room Type</Data.Title>
          <Data.Value>{room.room_type || "Standard Room"}</Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>Total Members</Data.Title>
          <Data.Value>{room.joined_members.toLocaleString()}</Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>Local Members</Data.Title>
          <Data.NumericValue value={room.joined_local_members} />
        </Data.Item>

        <Data.Item>
          <Data.Title>Local Devices</Data.Title>
          <Data.NumericValue value={room.joined_local_devices} />
        </Data.Item>

        <Data.Item>
          <Data.Title>Creator</Data.Title>
          <Data.Value>{room.creator}</Data.Value>
        </Data.Item>

        <Data.Item>
          <Data.Title>State Events</Data.Title>
          <Data.NumericValue value={room.state_events} />
        </Data.Item>

        {room.avatar && (
          <Data.Item>
            <Data.Title>Avatar URL</Data.Title>
            <Data.Value className="break-all">{room.avatar}</Data.Value>
          </Data.Item>
        )}

        <Data.Item>
          <Data.Title>Forgotten</Data.Title>
          <Data.Value>{room.forgotten ? "Yes" : "No"}</Data.Value>
        </Data.Item>
      </Data.Grid>
    </Navigation.Details>
  );
}
