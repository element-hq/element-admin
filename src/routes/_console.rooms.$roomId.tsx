/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { H3, Text, Tooltip } from "@vector-im/compound-web";
import cx from "classnames";
import { FormattedNumber, useIntl } from "react-intl";

import { wellKnownQuery } from "@/api/matrix";
import { roomDetailQuery } from "@/api/synapse";
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

      <div className="flex flex-col gap-6">
        <Info>
          <InfoTitle>Visibility</InfoTitle>
          <InfoValue>{room.public ? "Public" : "Private"}</InfoValue>
        </Info>

        <Info>
          <InfoTitle>Encryption</InfoTitle>
          <InfoValue>{formatEncryption(room.encryption)}</InfoValue>
        </Info>

        <Info>
          <InfoTitle>Join Rules</InfoTitle>
          <InfoValue>{formatJoinRules(room.join_rules)}</InfoValue>
        </Info>

        <Info>
          <InfoTitle>Guest Access</InfoTitle>
          <InfoValue>{formatGuestAccess(room.guest_access)}</InfoValue>
        </Info>

        <Info>
          <InfoTitle>History Visibility</InfoTitle>
          <InfoValue>
            {formatHistoryVisibility(room.history_visibility)}
          </InfoValue>
        </Info>

        <Info>
          <InfoTitle>Federatable</InfoTitle>
          <InfoValue>{room.federatable ? "Yes" : "No"}</InfoValue>
        </Info>

        <Info>
          <InfoTitle>Room Version</InfoTitle>
          <InfoValue>{room.version}</InfoValue>
        </Info>

        <Info>
          <InfoTitle>Room Type</InfoTitle>
          <InfoValue>{room.room_type || "Standard Room"}</InfoValue>
        </Info>

        <Info>
          <InfoTitle>Total Members</InfoTitle>
          <InfoValue>{room.joined_members.toLocaleString()}</InfoValue>
        </Info>

        <Info>
          <InfoTitle>Local Members</InfoTitle>
          <InfoValue>
            <FormattedNumber value={room.joined_local_members} />
          </InfoValue>
        </Info>

        <Info>
          <InfoTitle>Local Devices</InfoTitle>
          <InfoValue>
            <FormattedNumber value={room.joined_local_devices} />
          </InfoValue>
        </Info>

        <Info>
          <InfoTitle>Creator</InfoTitle>
          <InfoValue>{room.creator}</InfoValue>
        </Info>

        <Info>
          <InfoTitle>State Events</InfoTitle>
          <InfoValue>
            <FormattedNumber value={room.state_events} />
          </InfoValue>
        </Info>

        {room.avatar && (
          <Info>
            <InfoTitle>Avatar URL</InfoTitle>
            <InfoValue className="break-all">{room.avatar}</InfoValue>
          </Info>
        )}

        <Info>
          <InfoTitle>Forgotten</InfoTitle>
          <InfoValue>{room.forgotten ? "Yes" : "No"}</InfoValue>
        </Info>
      </div>
    </Navigation.Details>
  );
}

const Info = ({ className, ...props }: React.ComponentProps<"section">) => (
  <section
    className={cx(className, "flex flex-col gap-2 items-start")}
    {...props}
  />
);

const InfoTitle = ({ className, ...props }: React.ComponentProps<"p">) => (
  <Text size="sm" className={cx(className, "text-text-secondary")} {...props} />
);

const InfoValue = ({ className, ...props }: React.ComponentProps<"p">) => (
  <Text size="md" className={cx(className, "text-text-primary")} {...props} />
);
