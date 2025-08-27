/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Badge, Button, H3, Text } from "@vector-im/compound-web";

import { wellKnownQuery } from "@/api/matrix";
import { roomDetailQuery } from "@/api/synapse";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";

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
  const { credentials } = Route.useRouteContext();
  const { roomId } = Route.useParams();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const { data: room } = useSuspenseQuery(roomDetailQuery(synapseRoot, roomId));

  const formatRoomName = () => {
    if (room.name) return room.name;
    if (room.canonical_alias) return room.canonical_alias;
    return room.room_id;
  };

  return (
    <Navigation.Details>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ButtonLink
              kind="secondary"
              size="sm"
              Icon={ArrowLeftIcon}
              to="/rooms"
            >
              Back to Rooms
            </ButtonLink>
            <H3>Room Details</H3>
          </div>
        </div>

        <div className="bg-bg-subtle-secondary rounded-lg">
          <div className="px-6 py-5 border-b border-border-interactive-secondary">
            <H3>{formatRoomName()}</H3>
            <Text size="sm" className="text-text-secondary">
              Room ID: {room.room_id}
            </Text>
            {room.topic && (
              <Text size="sm" className="text-text-secondary mt-1">
                {room.topic}
              </Text>
            )}
          </div>

          <div className="px-6 py-5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Text size="sm" weight="medium">
                  Visibility
                </Text>
                <Badge kind={room.public ? "blue" : "grey"}>
                  {room.public ? "Public" : "Private"}
                </Badge>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  Encryption
                </Text>
                <Badge kind={room.encryption ? "green" : "grey"}>
                  {formatEncryption(room.encryption)}
                </Badge>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  Join Rules
                </Text>
                <Badge
                  kind={
                    room.join_rules === "public"
                      ? "green"
                      : room.join_rules === "invite"
                        ? "blue"
                        : "grey"
                  }
                >
                  {formatJoinRules(room.join_rules)}
                </Badge>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  Guest Access
                </Text>
                <Badge
                  kind={room.guest_access === "can_join" ? "green" : "grey"}
                >
                  {formatGuestAccess(room.guest_access)}
                </Badge>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  History Visibility
                </Text>
                <Badge kind="blue">
                  {formatHistoryVisibility(room.history_visibility)}
                </Badge>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  Federatable
                </Text>
                <Badge kind={room.federatable ? "green" : "grey"}>
                  {room.federatable ? "Yes" : "No"}
                </Badge>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  Room Version
                </Text>
                <Badge kind="grey">{room.version}</Badge>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  Room Type
                </Text>
                <Badge kind="grey">{room.room_type || "Standard Room"}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Text size="sm" weight="medium">
                  Total Members
                </Text>
                <Text size="lg" weight="semibold">
                  {room.joined_members.toLocaleString()}
                </Text>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  Local Members
                </Text>
                <Text size="lg" weight="semibold">
                  {room.joined_local_members.toLocaleString()}
                </Text>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  Local Devices
                </Text>
                <Text size="lg" weight="semibold">
                  {room.joined_local_devices.toLocaleString()}
                </Text>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Text size="sm" weight="medium">
                  Creator
                </Text>
                <Text size="sm">{room.creator}</Text>
              </div>

              <div>
                <Text size="sm" weight="medium">
                  State Events
                </Text>
                <Text size="sm">{room.state_events.toLocaleString()}</Text>
              </div>
            </div>

            {room.canonical_alias &&
              room.canonical_alias !== formatRoomName() && (
                <div>
                  <Text size="sm" weight="medium">
                    Canonical Alias
                  </Text>
                  <Text size="sm">{room.canonical_alias}</Text>
                </div>
              )}

            {room.avatar && (
              <div>
                <Text size="sm" weight="medium">
                  Avatar URL
                </Text>
                <Text size="sm" className="break-all">
                  {room.avatar}
                </Text>
              </div>
            )}

            <div>
              <Text size="sm" weight="medium">
                Forgotten
              </Text>
              <Badge kind={room.forgotten ? "red" : "green"}>
                {room.forgotten ? "Yes" : "No"}
              </Badge>
            </div>

            <div className="pt-5 border-t border-border-interactive-secondary">
              <Text
                size="sm"
                weight="medium"
                className="text-text-secondary mb-4"
              >
                Actions
              </Text>
              <div className="flex gap-3 flex-wrap">
                <Button type="button" size="sm" disabled>
                  Edit Room
                </Button>
                <Button type="button" size="sm" kind="secondary" disabled>
                  View Members
                </Button>
                <Button type="button" size="sm" kind="secondary" disabled>
                  View Messages
                </Button>
                <Button type="button" size="sm" kind="secondary" disabled>
                  Block Room
                </Button>
                <Button
                  type="button"
                  size="sm"
                  kind="tertiary"
                  destructive
                  disabled
                >
                  Delete Room
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Navigation.Details>
  );
}
