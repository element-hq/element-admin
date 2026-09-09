// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useMutation,
  useSuspenseQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CloseIcon,
  DeleteIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Alert,
  Button,
  Form,
  H3,
  Text,
  Tooltip,
} from "@vector-im/compound-web";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import { wellKnownQuery as matrixWellKnownQuery } from "@/api/matrix";
import {
  deleteRoom,
  roomDetailQuery,
  scheduledTasksForResource,
} from "@/api/synapse";
import type { ScheduledTask } from "@/api/synapse";
import * as Data from "@/components/data";
import * as Dialog from "@/components/dialog";
import { ButtonLink, TextLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import { RoomAvatar, RoomDisplayName } from "@/components/room-info";
import * as messages from "@/messages";
import { assertNever } from "@/utils/never";

export const Route = createFileRoute("/_console/rooms/$roomId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    const wellKnown = await queryClient.ensureQueryData(
      matrixWellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    await Promise.all([
      queryClient.ensureQueryData(roomDetailQuery(synapseRoot, params.roomId)),
      queryClient.ensureQueryData(
        scheduledTasksForResource(synapseRoot, params.roomId),
      ),
    ]);
  },
  component: RouteComponent,
  notFoundComponent: NotFoundComponent,
});

const detailsLabel = defineMessage({
  id: "pages.rooms.details_label",
  defaultMessage: "Room details",
  description: "The accessible name of the room details panel",
});

function NotFoundComponent() {
  const { roomId } = Route.useParams();
  const {
    credentials: { serverName },
  } = Route.useRouteContext();
  const intl = useIntl();
  return (
    <Navigation.Details
      className="gap-4"
      aria-label={intl.formatMessage(detailsLabel)}
    >
      <CloseSidebar />

      <Alert
        type="critical"
        title={intl.formatMessage({
          id: "pages.rooms.not_found.title",
          defaultMessage: "Room not found",
          description: "The title of the alert when a room could not be found",
        })}
      >
        <FormattedMessage
          id="pages.rooms.not_found.description"
          defaultMessage="The requested room ({roomId}) could not be found on {serverName}."
          description="The description of the alert when a room could not be found"
          values={{
            roomId,
            serverName,
          }}
        />
      </Alert>
    </Navigation.Details>
  );
}

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

const CloseSidebar: React.FC = () => {
  const intl = useIntl();
  const search = Route.useSearch();
  return (
    <div className="flex items-center justify-end">
      <Tooltip label={intl.formatMessage(messages.actionClose)}>
        <ButtonLink
          iconOnly
          to="/rooms"
          search={search}
          kind="tertiary"
          size="md"
          Icon={CloseIcon}
        />
      </Tooltip>
    </div>
  );
};

interface RoomCommonProps {
  readonly synapseRoot: string;
  readonly roomId: string;
  readonly roomName: string | null;
  readonly roomCanonicalAlias: string | null;
  readonly roomType: string | null;
  readonly members: number;
}

function DeleteRoomDialog(props: RoomCommonProps) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async ({ block }: { block: boolean }) => {
      return await deleteRoom(queryClient, props.synapseRoot, props.roomId, {
        block,
      });
    },
    onError: (): void => {
      toast.error(
        intl.formatMessage({
          id: "pages.rooms.delete_room.error",
          defaultMessage: "Failed to schedule room deletion",
          description:
            "Toast message shown when room deletion scheduling fails",
        }),
      );
    },

    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.rooms.delete_room.success",
          defaultMessage: "Room deletion scheduled",
          description:
            "Toast message shown when room deletion is successfully scheduled",
        }),
      );

      await queryClient.invalidateQueries({
        queryKey: [
          "synapse",
          "scheduledTasks",
          props.synapseRoot,
          props.roomId,
        ],
      });
      setOpen(false);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const block = formData.get("block") === "on";
    deleteMutation.mutate({ block });
  };

  const isPending = deleteMutation.isPending;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button kind="destructive" size="md" Icon={DeleteIcon}>
          <FormattedMessage {...messages.actionDelete} />
        </Button>
      }
    >
      <Dialog.Title>
        <FormattedMessage
          id="pages.rooms.delete_room.title"
          defaultMessage="Delete this room?"
          description="Title for the delete room dialog"
        />
      </Dialog.Title>

      <Dialog.Description asChild>
        <Form.Root onSubmit={handleSubmit}>
          <RoomChip {...props} />

          <Form.InlineField
            name="block"
            control={<Form.CheckboxControl disabled={isPending} />}
          >
            <Form.Label>
              <FormattedMessage
                id="pages.rooms.delete_room.block.label"
                defaultMessage="Block room"
                description="Label for the block users checkbox in the delete room dialog"
              />
            </Form.Label>
            <Form.HelpMessage>
              <FormattedMessage
                id="pages.rooms.delete_room.block.help"
                defaultMessage="Prevent users from rejoining the room after deletion."
                description="Help message for the block users checkbox in the delete room dialog"
              />
            </Form.HelpMessage>
          </Form.InlineField>

          <Alert
            type="critical"
            title={intl.formatMessage({
              id: "pages.rooms.delete_room.alert.title",
              defaultMessage: "You’re about to delete room data",
              description: "Title of the alert in the delete room dialog",
            })}
          >
            <FormattedMessage
              id="pages.rooms.delete_room.alert.description"
              defaultMessage="This will permanently delete all messages or media uploaded to the server and remove this room from the directory. Members will lose access to their messages and the room will be removed from their room list."
              description="Description of the alert in the delete room dialog"
            />
          </Alert>

          <Form.Submit
            disabled={isPending}
            Icon={DeleteIcon}
            kind="primary"
            destructive
          >
            <FormattedMessage
              id="pages.rooms.delete_room.button"
              defaultMessage="Delete permanently"
              description="Label for the button to delete a room"
            />
          </Form.Submit>
        </Form.Root>
      </Dialog.Description>

      <Dialog.Close asChild>
        <Button kind="tertiary" disabled={isPending}>
          <FormattedMessage {...messages.actionCancel} />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
  );
}

interface ScheduledTaskProps {
  readonly task: ScheduledTask;
}

const ScheduledTaskDisplay: React.FC<ScheduledTaskProps> = ({
  task,
}: ScheduledTaskProps) => {
  const intl = useIntl();
  switch (task.status) {
    case "scheduled": {
      // For scheduled tasks, Synapse uses timestamp_ms as the future launch time.
      return (
        <Alert
          title={intl.formatMessage({
            id: "pages.rooms.delete_room.success",
            defaultMessage: "Room deletion scheduled",
            description:
              "Toast message shown when room deletion is successfully scheduled",
          })}
          type="info"
        >
          {intl.formatDate(task.timestamp_ms, { dateStyle: "short" })}{" "}
          {intl.formatTime(task.timestamp_ms, { timeStyle: "short" })}
        </Alert>
      );
    }

    case "active": {
      return (
        <Alert
          title={intl.formatMessage({
            id: "pages.rooms.deletion.in_progress.title",
            defaultMessage: "Deletion in progress",
            description:
              "When there is a room deletion task that is in progress, this is the title of the alert shown.",
          })}
          type="info"
        >
          <FormattedMessage
            id="pages.rooms.deletion.in_progress.description"
            defaultMessage="Room deletion task is in progress since {timestamp, date, short} at {timestamp, time, short}."
            description="When there is a room deletion task that is in progress, this is the description of the alert shown."
            values={{ timestamp: task.timestamp_ms }}
          />
        </Alert>
      );
    }

    case "complete": {
      return (
        <Alert
          type="success"
          title={intl.formatMessage({
            id: "pages.rooms.deletion.success.title",
            defaultMessage: "Deletion successful",
            description:
              "When there is a room deletion task that has completed successfully, this is the title of the alert shown.",
          })}
        >
          <FormattedMessage
            id="pages.rooms.deletion.success.description"
            defaultMessage="Room deletion task completed successfully on {timestamp, date, short} at {timestamp, time, short}."
            description="When there is a room deletion task that has completed successfully, this is the description of the alert shown."
            values={{ timestamp: task.timestamp_ms }}
          />
        </Alert>
      );
    }

    case "failed": {
      return (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: "pages.rooms.deletion.failure.title",
            defaultMessage: "Deletion failed",
            description:
              "When there is a room deletion task that has failed, this is the title of the alert shown.",
          })}
        >
          <FormattedMessage
            id="pages.rooms.deletion.failure.description"
            defaultMessage="Room deletion task failed on {timestamp, date, short} at {timestamp, time, short} with error: {error}"
            description="When there is a room deletion task that has failed, this is the description of the alert shown."
            values={{
              timestamp: task.timestamp_ms,
              error: task.error,
            }}
          />
        </Alert>
      );
    }

    default: {
      return assertNever(task.status);
    }
  }
};

const RoomDeletionStatusDisplay: React.FC<RoomCommonProps> = (
  props: RoomCommonProps,
) => {
  const { data: scheduledTasks } = useSuspenseQuery(
    scheduledTasksForResource(props.synapseRoot, props.roomId),
  );

  const deletionTasks = scheduledTasks?.scheduled_tasks.filter(
    (task) =>
      task.action === "shutdown_and_purge_room" || task.action === "purge_room",
  );

  const displayDeleteButton = deletionTasks.every(
    (task) => task.status === "failed",
  );

  return (
    <div className="flex flex-col gap-4">
      {displayDeleteButton && <DeleteRoomDialog {...props} />}

      {scheduledTasks.scheduled_tasks.map((scheduledTask) => (
        <ScheduledTaskDisplay key={scheduledTask.id} task={scheduledTask} />
      ))}
    </div>
  );
};

function RoomChip(props: RoomCommonProps) {
  return (
    <div className="border border-separator-primary p-3 flex gap-3 items-center">
      <RoomAvatar {...props} size="32px" />
      <div className="flex flex-col">
        <Text size="md" weight="semibold" className="text-text-primary">
          <RoomDisplayName {...props} />
        </Text>
        <Text size="sm" weight="regular" className="text-text-secondary">
          {props.roomId}
        </Text>
      </div>
    </div>
  );
}

// The user list searches on the username, not on the full Matrix ID, so only a
// creator from this server can be looked up there. A room created under room
// version 11 or later reports no creator at all.
function RoomCreator({
  creator,
  serverName,
}: {
  creator: string;
  serverName: string;
}) {
  if (!creator) {
    // oxlint-disable-next-line formatjs/no-literal-string-in-jsx
    return <Data.Value>—</Data.Value>;
  }

  const separator = creator.indexOf(":");
  if (!creator.startsWith("@") || creator.slice(separator + 1) !== serverName) {
    return <Data.Value>{creator}</Data.Value>;
  }

  return (
    <Data.Value>
      <TextLink to="/users" search={{ search: creator.slice(1, separator) }}>
        {creator}
      </TextLink>
    </Data.Value>
  );
}

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const { roomId } = Route.useParams();

  const { data: wellKnown } = useSuspenseQuery(
    matrixWellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const { data: room } = useSuspenseQuery(roomDetailQuery(synapseRoot, roomId));

  const intl = useIntl();

  return (
    <Navigation.Details aria-label={intl.formatMessage(detailsLabel)}>
      <CloseSidebar />

      <div className="py-6 flex flex-col gap-4">
        <div className="self-center">
          <RoomAvatar
            roomId={room.room_id}
            roomName={room.name}
            roomCanonicalAlias={room.canonical_alias}
            roomType={room.room_type}
            members={room.joined_members}
            synapseRoot={synapseRoot}
            size="64px"
          />
        </div>

        <div className="flex flex-col gap-1 text-center">
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
            <Text size="md" className="text-text-primary truncate">
              {room.canonical_alias}
            </Text>
          )}
          <Text size="md" className="text-text-secondary truncate">
            {room.room_id}
          </Text>
          {room.topic && (
            <Text size="sm" className="text-text-secondary truncate">
              {room.topic}
            </Text>
          )}
        </div>

        <RoomDeletionStatusDisplay
          roomId={room.room_id}
          roomName={room.name}
          roomCanonicalAlias={room.canonical_alias}
          roomType={room.room_type}
          members={room.joined_members}
          synapseRoot={synapseRoot}
        />
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
          <Data.NumericValue value={room.joined_members} />
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
          <RoomCreator
            creator={room.creator}
            serverName={credentials.serverName}
          />
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
