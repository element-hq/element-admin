// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  useMutation,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Alert, Form, InlineSpinner, Text } from "@vector-im/compound-web";
import cx from "classnames";
import { useId, useState } from "react";
import { toast } from "react-hot-toast";
import {
  defineMessage,
  FormattedMessage,
  type IntlShape,
  useIntl,
} from "react-intl";
import * as v from "valibot";

import { userByUsernameQuery } from "@/api/mas";
import type {
  SingleResourceForUser,
  SingleResponseForUser,
} from "@/api/mas/api";
import { wellKnownQuery } from "@/api/matrix";
import {
  sendServerAnnouncement,
  sendServerNotice,
  serverAnnouncementsQuery,
  serverNoticesEnabledQuery,
  type ServerAnnouncementRoom,
  type ServerEventParameters,
} from "@/api/synapse";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import { LocalizedError, MatrixStandardError } from "@/errors";
import AppFooter from "@/ui/footer";
import { RoomPicker } from "@/ui/room-picker";
import { UserPicker } from "@/ui/user-picker";
import { markdownMessageContent } from "@/utils/markdown";
import { assertNever } from "@/utils/never";

const AnnouncementsSearchParameters = v.object({
  user: v.optional(v.string()),
  room: v.optional(v.string()),
});

type AnnouncementsSearch = v.InferOutput<typeof AnnouncementsSearchParameters>;

const titleMessage = defineMessage({
  id: "pages.announcements.title",
  defaultMessage: "Send an announcement",
  description: "The title of the page to send a server announcement or notice",
});

const roomSuccessMessage = defineMessage({
  id: "pages.announcements.send.room_success",
  defaultMessage: "Announcement sent",
  description: "Toast message when a message was sent to an announcement room",
});

const userSuccessMessage = defineMessage({
  id: "pages.announcements.send.user_success",
  defaultMessage: "Server notice sent",
  description: "Toast message when a server notice was sent to a user",
});

const roomErrorMessage = defineMessage({
  id: "pages.announcements.send.room_error",
  defaultMessage: "Failed to send the announcement",
  description:
    "Title of the alert shown when sending a message to an announcement room failed",
});

const userErrorMessage = defineMessage({
  id: "pages.announcements.send.user_error",
  defaultMessage: "Failed to send the server notice",
  description:
    "Title of the alert shown when sending a server notice to a user failed",
});

/** The localpart of a Matrix ID on this server, or null for any other input. */
const localLocalpart = (mxid: string, serverName: string): string | null => {
  const separator = mxid.indexOf(":");
  if (!mxid.startsWith("@") || separator === -1) return null;
  if (mxid.slice(separator + 1) !== serverName) return null;
  return mxid.slice(1, separator);
};

const descriptionMessage = defineMessage({
  id: "pages.announcements.description",
  defaultMessage:
    "Post a message as the server to one user, or to everyone through an announcement room.",
  description:
    "The description of the page to send a server announcement or notice",
});

export const Route = createFileRoute("/_console/announcements")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  validateSearch: AnnouncementsSearchParameters,

  loaderDeps: ({ search }) => ({ user: search.user }),

  loader: async ({ context: { queryClient, credentials }, deps: { user } }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;
    const localpart =
      user === undefined ? null : localLocalpart(user, credentials.serverName);

    await Promise.all([
      queryClient.ensureQueryData(serverAnnouncementsQuery(synapseRoot)),
      queryClient.ensureQueryData(serverNoticesEnabledQuery(synapseRoot)),
      localpart !== null &&
        queryClient.ensureQueryData(
          userByUsernameQuery(credentials.serverName, localpart),
        ),
    ]);
  },

  pendingComponent: () => (
    <Navigation.Content>
      <Navigation.Main>
        <Page.Header>
          <Page.Title>
            <FormattedMessage {...titleMessage} />
          </Page.Title>
          <Page.Description>
            <FormattedMessage {...descriptionMessage} />
          </Page.Description>
        </Page.Header>

        <div className="flex flex-col gap-4 max-w-xl">
          <Placeholder.LoadingText />
          <Placeholder.Text />
          <Placeholder.Text />
        </div>
      </Navigation.Main>

      <AppFooter />
    </Navigation.Content>
  ),

  component: RouteComponent,
});

// Mirrors the look of compound's `Form.TextControl`, which only renders an
// `<input>`.
const controlClassName =
  "border border-border-interactive-primary bg-bg-canvas-default rounded-lg px-4 py-3 text-text-primary hover:border-border-interactive-hovered focus:outline-2 focus:outline-border-focused focus:border-transparent data-[invalid]:border-text-critical-primary data-[invalid]:hover:border-text-critical-primary disabled:bg-bg-canvas-disabled disabled:text-text-disabled disabled:border-border-disabled";

type Recipient = "user" | "room";
type ContentMode = "message" | "raw";

type RoomsStatus =
  | { kind: "unsupported" }
  | { kind: "empty" }
  | { kind: "available"; rooms: ServerAnnouncementRoom[] };

type SendRequest =
  | { kind: "user"; mxid: string; parameters: ServerEventParameters }
  | {
      kind: "room";
      room: ServerAnnouncementRoom;
      parameters: ServerEventParameters;
    };

interface RawErrors {
  type?: "member_event";
  content?: "not_object";
}

const errorText = (intl: IntlShape, error: unknown): string => {
  if (error instanceof MatrixStandardError) return error.errorMessage;
  if (error instanceof LocalizedError) {
    return intl.formatMessage(error.localizedMessage, error.localizedValues);
  }
  return String(error);
};

function RouteComponent() {
  const { credentials } = Route.useRouteContext();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  return (
    <Navigation.Content>
      <Navigation.Main>
        <Page.Header>
          <Page.Title>
            <FormattedMessage {...titleMessage} />
          </Page.Title>
          <Page.Description>
            <FormattedMessage {...descriptionMessage} />
          </Page.Description>
        </Page.Header>

        <SendForm
          serverName={credentials.serverName}
          synapseRoot={synapseRoot}
        />
      </Navigation.Main>

      <AppFooter />
    </Navigation.Content>
  );
}

interface RecipientCardProps {
  value: Recipient;
  checked: boolean;
  disabled: boolean;
  onSelect: (value: Recipient) => void;
  label: React.ReactNode;
  help: React.ReactNode;
  status?: React.ReactNode;
}

// The whole card is the radio's label, so clicking anywhere on it selects the
// radio. The radio is named by the title alone; the rest describes it.
const RecipientCard = ({
  value,
  checked,
  disabled,
  onSelect,
  label,
  help,
  status,
}: RecipientCardProps) => {
  const titleId = useId();
  const helpId = useId();
  const statusId = useId();
  return (
    <label
      className={cx(
        "flex-1 flex gap-3 border rounded-lg p-4",
        checked ? "border-bg-accent-rest" : "border-separator-primary",
        disabled
          ? "bg-bg-canvas-disabled cursor-not-allowed"
          : "cursor-pointer",
      )}
    >
      <Form.RadioInput
        name="recipient"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        aria-labelledby={titleId}
        aria-describedby={status ? `${helpId} ${statusId}` : helpId}
      />
      <span className="flex flex-col gap-1">
        <Text
          as="span"
          id={titleId}
          size="md"
          weight="medium"
          className={disabled ? "text-text-disabled" : "text-text-primary"}
        >
          {label}
        </Text>
        <Text as="span" id={helpId} size="sm" className="text-text-secondary">
          {help}
        </Text>
        {status && (
          <Text
            as="span"
            id={statusId}
            size="sm"
            className="text-text-secondary"
          >
            {status}
          </Text>
        )}
      </span>
    </label>
  );
};

interface SendFormProps {
  serverName: string;
  synapseRoot: string;
}

const mxidOf = (user: SingleResourceForUser, serverName: string): string =>
  `@${user.attributes.username}:${serverName}`;

function SendForm({ serverName, synapseRoot }: SendFormProps) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  // The chosen user or room lives in the URL; replacing the history entry keeps
  // the back button for leaving the page.
  const search = Route.useSearch();
  const setSearch = (next: AnnouncementsSearch) =>
    navigate({ to: ".", search: next, replace: true });

  // Only decides the card while the URL names neither a user nor a room.
  const [cardChoice, setCardChoice] = useState<Recipient>("user");
  const recipient: Recipient =
    search.room === undefined
      ? search.user === undefined
        ? cardChoice
        : "user"
      : "room";
  const [contentMode, setContentMode] = useState<ContentMode>("message");
  const [body, setBody] = useState("");
  const [eventType, setEventType] = useState("m.room.message");
  const [rawContent, setRawContent] = useState("");
  const [rawErrors, setRawErrors] = useState<RawErrors>({});

  const userLocalpart =
    search.user === undefined ? null : localLocalpart(search.user, serverName);
  // Zero or one query, as the URL may name no user or one from elsewhere. The
  // loader has fetched it, or a pick has put it in the cache.
  const [userLookup] = useSuspenseQueries({
    queries: [userByUsernameQuery(serverName, userLocalpart ?? "")].slice(
      0,
      userLocalpart === null ? 0 : 1,
    ),
  });
  const lookedUpUser = userLookup?.data?.data ?? null;
  const selectedUser =
    lookedUpUser?.attributes.deactivated_at === null ? lookedUpUser : null;

  let lookupError: React.ReactNode = null;
  if (search.user !== undefined && selectedUser === null) {
    lookupError = (
      <FormattedMessage
        id="pages.announcements.user.not_found"
        defaultMessage="{mxid} is not a user of this server"
        description="Error shown when the page was opened for a user which does not exist on this server"
        values={{ mxid: search.user }}
      />
    );
  }

  const { data: announcements } = useSuspenseQuery(
    serverAnnouncementsQuery(synapseRoot),
  );
  let roomsStatus: RoomsStatus;
  if (announcements === null) {
    roomsStatus = { kind: "unsupported" };
  } else if (announcements.rooms.length === 0) {
    roomsStatus = { kind: "empty" };
  } else {
    roomsStatus = { kind: "available", rooms: announcements.rooms };
  }

  const rooms = roomsStatus.kind === "available" ? roomsStatus.rooms : [];
  const roomsUsable = roomsStatus.kind === "available";

  const { data: noticesEnabled } = useSuspenseQuery(
    serverNoticesEnabledQuery(synapseRoot),
  );

  // The asked-for card, or the other one when it is unavailable.
  let effectiveRecipient: Recipient | null = null;
  if (recipient === "room") {
    if (roomsUsable) effectiveRecipient = "room";
    else if (noticesEnabled) effectiveRecipient = "user";
  } else if (noticesEnabled) {
    effectiveRecipient = "user";
  } else if (roomsUsable) {
    effectiveRecipient = "room";
  }
  const selectedRoom = rooms.find((room) => room.id === search.room) ?? null;
  const unknownRoom =
    search.room !== undefined &&
    roomsStatus.kind !== "unsupported" &&
    selectedRoom === null;

  const mutation = useMutation({
    mutationFn: async (request: SendRequest): Promise<unknown> =>
      request.kind === "user"
        ? sendServerNotice(queryClient, synapseRoot, {
            user_id: request.mxid,
            ...request.parameters,
          })
        : sendServerAnnouncement(
            queryClient,
            synapseRoot,
            request.room.id,
            request.parameters,
          ),

    onSuccess(_result, request) {
      toast.success(
        request.kind === "room"
          ? intl.formatMessage(roomSuccessMessage)
          : intl.formatMessage(userSuccessMessage),
      );
      setBody("");
      setRawContent("");
    },
  });

  // Any edit makes the last failure stale.
  const edited =
    <A extends unknown[]>(update: (...args: A) => void) =>
    (...args: A) => {
      if (mutation.isError) mutation.reset();
      update(...args);
    };

  const selectCard = edited((card: Recipient) => {
    setCardChoice(card);
    if (card !== recipient) setSearch({});
  });
  const selectUser = edited((user: SingleResourceForUser | null) => {
    if (user) {
      // The URL is about to name this user, so it needs no lookup.
      const response: SingleResponseForUser = {
        data: user,
        links: { self: `/api/admin/v1/users/${user.id}` },
      };
      queryClient.setQueryData(
        userByUsernameQuery(serverName, user.attributes.username).queryKey,
        response,
      );
    }
    setCardChoice("user");
    setSearch(user ? { user: mxidOf(user, serverName) } : {});
  });
  const selectRoom = edited((room: ServerAnnouncementRoom | null) => {
    setCardChoice("room");
    setSearch(room ? { room: room.id } : {});
  });

  const hasRecipient =
    effectiveRecipient === "user"
      ? selectedUser !== null
      : effectiveRecipient === "room" &&
        selectedRoom !== null &&
        selectedRoom.room_id !== null;
  const hasContent = contentMode === "raw" || body.trim() !== "";
  const canSubmit = hasRecipient && hasContent;

  const onSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    let parameters: ServerEventParameters;
    if (contentMode === "message") {
      parameters = { content: markdownMessageContent(body) };
    } else {
      const type = eventType.trim();

      let content: unknown;
      try {
        content = JSON.parse(rawContent);
      } catch {
        content = undefined;
      }

      const errors: RawErrors = {};
      if (type === "m.room.member") {
        errors.type = "member_event";
      }
      if (
        typeof content !== "object" ||
        content === null ||
        Array.isArray(content)
      ) {
        errors.content = "not_object";
      }

      setRawErrors(errors);
      if (errors.type || errors.content) return;

      parameters = { type, content: content as Record<string, unknown> };
    }

    if (effectiveRecipient === "user" && selectedUser) {
      mutation.mutate({
        kind: "user",
        mxid: mxidOf(selectedUser, serverName),
        parameters,
      });
    } else if (effectiveRecipient === "room" && selectedRoom) {
      mutation.mutate({ kind: "room", room: selectedRoom, parameters });
    }
  };

  return (
    <Form.Root onSubmit={onSubmit} className="flex flex-col gap-8 max-w-xl">
      <fieldset className="flex flex-col gap-4">
        <Text as="legend" size="lg" weight="semibold" className="mb-4">
          <FormattedMessage
            id="pages.announcements.recipient.legend"
            defaultMessage="Recipient"
            description="Heading of the section to choose who receives the message"
          />
        </Text>

        <div className="flex flex-col sm:flex-row gap-4">
          <RecipientCard
            value="user"
            checked={effectiveRecipient === "user"}
            disabled={!noticesEnabled}
            onSelect={selectCard}
            label={
              <FormattedMessage
                id="pages.announcements.recipient.user"
                defaultMessage="A specific user"
                description="Label of the card to send a server notice to a single user"
              />
            }
            help={
              <FormattedMessage
                id="pages.announcements.recipient.user_help"
                defaultMessage="Sends a server notice to that user only."
                description="Help text of the card to send a server notice to a single user"
              />
            }
            status={
              !noticesEnabled && (
                <FormattedMessage {...noticesDisabledMessage} />
              )
            }
          />

          <RecipientCard
            value="room"
            checked={effectiveRecipient === "room"}
            disabled={roomsStatus.kind !== "available"}
            onSelect={selectCard}
            label={
              <FormattedMessage
                id="pages.announcements.recipient.room"
                defaultMessage="An announcement room"
                description="Label of the card to send a message to an announcement room"
              />
            }
            help={
              <FormattedMessage
                id="pages.announcements.recipient.room_help"
                defaultMessage="Sends to every user the room is delivered to."
                description="Help text of the card to send a message to an announcement room"
              />
            }
            status={roomsStatusMessage(roomsStatus)}
          />
        </div>

        {unknownRoom && (
          <Alert
            type="info"
            title={intl.formatMessage(
              {
                id: "pages.announcements.recipient.unknown_room",
                defaultMessage:
                  "The announcement room “{id}” is not configured on this server.",
                description:
                  "Shown when the page was opened for an announcement room id which is not in the Synapse configuration",
              },
              { id: search.room },
            )}
          />
        )}

        {effectiveRecipient === "user" && (
          <Form.Field name="user">
            <Form.Label>
              <FormattedMessage
                id="pages.announcements.user.label"
                defaultMessage="User"
                description="Label of the field to pick the user who receives the server notice"
              />
            </Form.Label>
            <UserPicker
              // The picker owns its selection, so a user named by a new URL
              // starts a fresh one.
              key={search.user ?? ""}
              serverName={serverName}
              synapseRoot={synapseRoot}
              defaultUser={selectedUser}
              onChange={selectUser}
            />
            {lookupError && (
              <Form.ErrorMessage>{lookupError}</Form.ErrorMessage>
            )}
          </Form.Field>
        )}
        {effectiveRecipient === "room" && (
          <Form.Field name="room">
            <Form.Label>
              <FormattedMessage
                id="pages.announcements.room.label"
                defaultMessage="Announcement room"
                description="Label of the field to choose the announcement room to send to"
              />
            </Form.Label>
            <RoomPicker
              synapseRoot={synapseRoot}
              rooms={rooms}
              value={selectedRoom}
              onChange={selectRoom}
            />
            {selectedRoom?.room_id === null && (
              <Form.HelpMessage>
                <FormattedMessage
                  id="pages.announcements.room.deleted_help"
                  defaultMessage="This room was deleted. Restart Synapse to recreate it."
                  description="Help text under the announcement room picker when the chosen room was deleted"
                />
              </Form.HelpMessage>
            )}
          </Form.Field>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <Text as="legend" size="lg" weight="semibold" className="mb-4">
          <FormattedMessage
            id="pages.announcements.content.legend"
            defaultMessage="Content"
            description="Heading of the section to write the message"
          />
        </Text>

        <div className="flex gap-6">
          <Form.InlineField
            name="content_mode"
            control={
              <Form.RadioControl
                value="message"
                checked={contentMode === "message"}
                onChange={edited(() => {
                  setContentMode("message");
                  setRawErrors({});
                })}
              />
            }
          >
            <Form.Label>
              <FormattedMessage
                id="pages.announcements.content.message"
                defaultMessage="Message"
                description="Label of the option to write a text message"
              />
            </Form.Label>
          </Form.InlineField>

          <Form.InlineField
            name="content_mode"
            control={
              <Form.RadioControl
                value="raw"
                checked={contentMode === "raw"}
                onChange={edited(() => {
                  setContentMode("raw");
                  setRawErrors({});
                })}
              />
            }
          >
            <Form.Label>
              <FormattedMessage
                id="pages.announcements.content.raw"
                defaultMessage="Raw event"
                description="Label of the option to write the event type and JSON content by hand"
              />
            </Form.Label>
          </Form.InlineField>
        </div>

        {contentMode === "message" ? (
          <TextAreaField
            name="body"
            value={body}
            onChange={edited(setBody)}
            disabled={mutation.isPending}
            label={
              <FormattedMessage
                id="pages.announcements.content.body_label"
                defaultMessage="Message"
                description="Label of the text area to write the message"
              />
            }
            help={
              <FormattedMessage
                id="pages.announcements.content.body_help"
                defaultMessage="Markdown is supported."
                description="Help text under the text area to write the message"
              />
            }
          />
        ) : (
          <>
            <Form.Field name="type" serverInvalid={!!rawErrors.type}>
              <Form.Label>
                <FormattedMessage
                  id="pages.announcements.raw.type_label"
                  defaultMessage="Event type"
                  description="Label of the field for the type of the raw event"
                />
              </Form.Label>
              <Form.TextControl
                required
                value={eventType}
                disabled={mutation.isPending}
                className="font-mono"
                onChange={edited(
                  (event: React.ChangeEvent<HTMLInputElement>) => {
                    setEventType(event.currentTarget.value);
                    setRawErrors(({ content }) => ({ content }));
                  },
                )}
              />
              {rawErrors.type && (
                <Form.ErrorMessage>
                  <FormattedMessage
                    id="pages.announcements.raw.member_event_error"
                    defaultMessage="Membership events cannot be sent."
                    description="Error shown under the raw event type when it is m.room.member"
                  />
                </Form.ErrorMessage>
              )}
            </Form.Field>

            <TextAreaField
              name="content"
              value={rawContent}
              onChange={edited((value: string) => {
                setRawContent(value);
                setRawErrors(({ type }) => ({ type }));
              })}
              disabled={mutation.isPending}
              monospace
              label={
                <FormattedMessage
                  id="pages.announcements.raw.content_label"
                  defaultMessage="Content (JSON)"
                  description="Label of the text area for the JSON content of the raw event"
                />
              }
              error={
                rawErrors.content === "not_object" ? (
                  <FormattedMessage
                    id="pages.announcements.raw.content_not_object"
                    defaultMessage="Content must be a JSON object"
                    description="Error shown under the raw event content when it is not a JSON object"
                  />
                ) : undefined
              }
            />
          </>
        )}
      </fieldset>

      {/* An `<output>` is a polite live region, so the error is announced when it appears. */}
      <output className="flex flex-col empty:hidden">
        {mutation.isError && (
          <SendFailure
            error={mutation.error}
            recipient={mutation.variables.kind}
          />
        )}
      </output>

      <Form.Submit
        kind="primary"
        className="self-start"
        disabled={!canSubmit || mutation.isPending}
      >
        {mutation.isPending && <InlineSpinner />}
        <FormattedMessage
          id="pages.announcements.send.button"
          defaultMessage="Send"
          description="Label of the button to send the server notice or announcement"
        />
      </Form.Submit>
    </Form.Root>
  );
}

const noticesDisabledMessage = defineMessage({
  id: "pages.announcements.recipient.notices_disabled",
  defaultMessage:
    "Server notices are not enabled on this server. Enable them under server_notices in the Synapse configuration.",
  description:
    "Shown in the user card, and under a failed send, when server notices are not configured. 'server_notices' is a configuration key and must not be translated.",
});

const roomsStatusMessage = (status: RoomsStatus): React.ReactNode => {
  switch (status.kind) {
    case "available": {
      return null;
    }
    case "unsupported": {
      return (
        <FormattedMessage
          id="pages.announcements.recipient.room_unsupported"
          defaultMessage="This version of Synapse does not support announcement rooms."
          description="Shown in the announcement room card when Synapse does not know the announcement rooms API"
        />
      );
    }
    case "empty": {
      return (
        <FormattedMessage
          id="pages.announcements.recipient.room_none_configured"
          defaultMessage="No announcement room is configured on this server. Add rooms under server_announcements in the Synapse configuration."
          description="Shown in the announcement room card when Synapse has no announcement room configured. 'server_announcements' is a configuration key and must not be translated."
        />
      );
    }
    default: {
      return assertNever(status);
    }
  }
};

interface TextAreaFieldProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  label: React.ReactNode;
  help?: React.ReactNode;
  error?: React.ReactNode;
  monospace?: boolean;
  disabled?: boolean;
}

const TextAreaField = ({
  name,
  value,
  onChange,
  label,
  help,
  error,
  monospace,
  disabled,
}: TextAreaFieldProps) => {
  const id = useId();
  const helpId = useId();
  const errorId = useId();
  const describedBy = [help && helpId, error && errorId].filter(Boolean);
  // A plain `<textarea>` is not a Radix control, so the label and messages are
  // linked to it by hand.
  return (
    <Form.Field name={name} serverInvalid={!!error}>
      <Form.Label htmlFor={id}>{label}</Form.Label>
      <textarea
        id={id}
        name={name}
        aria-describedby={describedBy.join(" ") || undefined}
        disabled={disabled}
        required
        rows={6}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        aria-invalid={!!error || undefined}
        data-invalid={error ? "" : undefined}
        className={cx(controlClassName, "resize-y", monospace && "font-mono")}
      />
      {help && <Form.HelpMessage id={helpId}>{help}</Form.HelpMessage>}
      {error && <Form.ErrorMessage id={errorId}>{error}</Form.ErrorMessage>}
    </Form.Field>
  );
};

const SendFailure = ({
  error,
  recipient,
}: {
  error: unknown;
  recipient: Recipient;
}) => {
  const intl = useIntl();
  // Matches the text of Synapse's error, which has no dedicated errcode.
  const notEnabled =
    recipient === "user" &&
    error instanceof MatrixStandardError &&
    error.errcode === "M_UNKNOWN" &&
    error.errorMessage.includes("not enabled");

  return (
    <Alert
      type="critical"
      title={
        recipient === "room"
          ? intl.formatMessage(roomErrorMessage)
          : intl.formatMessage(userErrorMessage)
      }
    >
      <span className="flex flex-col gap-1">
        <span>{errorText(intl, error)}</span>
        {notEnabled && (
          <span>
            <FormattedMessage {...noticesDisabledMessage} />
          </span>
        )}
      </span>
    </Alert>
  );
};
