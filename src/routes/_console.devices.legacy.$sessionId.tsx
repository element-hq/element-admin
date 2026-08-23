// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CloseIcon,
  DeleteIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Alert, Button, InlineSpinner, Tooltip } from "@vector-im/compound-web";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import { compatSessionQuery, finishCompatSession, userQuery } from "@/api/mas";
import * as Data from "@/components/data";
import { DetailHeader } from "@/components/detail-header";
import {
  DeviceInfo,
  DeviceTypeHero,
  useDeviceName,
  useParsedUserAgent,
} from "@/ui/device-info";
import { DeviceStatusBadge } from "@/ui/device-status-badge";
import { UserCard, UserCardBody } from "@/ui/entity-cards";
import * as Dialog from "@/components/dialog";
import { Disclosure } from "@/components/disclosure";
import { StaticEntityCard } from "@/components/entity-card";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as messages from "@/messages";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";
import { ensureParametersAreUlids } from "@/utils/parameters";
import { userAgentSummary } from "@/utils/user-agent";

export const Route = createFileRoute("/_console/devices/legacy/$sessionId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    ensureParametersAreUlids(params);
    const {
      data: { attributes },
    } = await queryClient.ensureQueryData(
      compatSessionQuery(credentials.serverName, params.sessionId),
    );
    queryClient.prefetchQuery(
      userQuery(credentials.serverName, attributes.user_id),
    );
  },
  component: SessionDetailComponent,
  notFoundComponent: NotFoundComponent,
});

const detailsLabel = defineMessage({
  id: "pages.devices.legacy.details_label",
  defaultMessage: "Legacy device details",
  description: "The accessible name of the legacy device details panel",
});

function NotFoundComponent() {
  const { sessionId } = Route.useParams();
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
          id: "pages.devices.legacy.not_found.title",
          defaultMessage: "Legacy device not found",
          description:
            "The title of the alert when a legacy device could not be found",
        })}
      >
        <FormattedMessage
          id="pages.devices.legacy.not_found.description"
          defaultMessage="The requested legacy device ({sessionId}) could not be found on {serverName}."
          description="The description of the alert when a legacy device could not be found"
          values={{ sessionId, serverName }}
        />
      </Alert>

      <ButtonLink
        kind="secondary"
        size="md"
        to="/devices/legacy"
        Icon={ArrowLeftIcon}
      >
        <FormattedMessage {...messages.actionGoBack} />
      </ButtonLink>
    </Navigation.Details>
  );
}

const CloseSidebar: React.FC = () => {
  const intl = useIntl();
  const search = Route.useSearch();
  return (
    <div className="flex items-center justify-end">
      <Tooltip label={intl.formatMessage(messages.actionClose)}>
        <ButtonLink
          iconOnly
          to="/devices/legacy"
          search={search}
          kind="tertiary"
          size="md"
          Icon={CloseIcon}
        />
      </Tooltip>
    </div>
  );
};

function SessionDetailComponent() {
  const { credentials } = Route.useRouteContext();
  const { sessionId } = Route.useParams();
  const queryClient = useQueryClient();
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  const {
    data: { data: session },
  } = useSuspenseQuery(compatSessionQuery(credentials.serverName, sessionId));

  const finished = !!session.attributes.finished_at;

  const userAgent = useParsedUserAgent(session.attributes.user_agent);
  const deviceName = useDeviceName({
    humanName: session.attributes.human_name,
    userAgent,
    fallback: session.attributes.device_id,
  });

  const { mutate: finishMutate, isPending: finishPending } = useMutation({
    mutationFn: () =>
      finishCompatSession(queryClient, credentials.serverName, sessionId),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.devices.legacy.finish.error",
          defaultMessage: "Failed to remove the legacy device",
          description:
            "Error toast when removing (signing out) a legacy device fails",
        }),
      );
    },
    onSuccess: async (data) => {
      toast.success(
        intl.formatMessage({
          id: "pages.devices.legacy.finish.success",
          defaultMessage: "Legacy device removed",
          description:
            "Success toast when a legacy device was removed (signed out)",
        }),
      );
      queryClient.setQueryData(
        compatSessionQuery(credentials.serverName, sessionId).queryKey,
        data,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["mas", "compat-sessions", credentials.serverName],
        }),
        // The user list can be filtered on `filter[has-active-compat-session]`
        // and the user detail pane shows a legacy device count, both of which
        // this sign-out invalidates.
        queryClient.invalidateQueries({
          queryKey: ["mas", "users", credentials.serverName],
        }),
      ]);
      setOpen(false);
    },
  });

  const handleConfirm = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      finishMutate();
    },
    [finishMutate],
  );

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (finishPending) return;
      setOpen(next);
    },
    [finishPending],
  );

  return (
    <Navigation.Details aria-label={intl.formatMessage(detailsLabel)}>
      <CloseSidebar />

      <div className="flex flex-col gap-6">
        <DetailHeader
          icon={<DeviceTypeHero deviceType={userAgent?.deviceType} />}
          title={deviceName}
          subtitle={userAgentSummary(userAgent)}
          badges={
            <DeviceStatusBadge
              finishedAt={session.attributes.finished_at}
              lastActiveAt={session.attributes.last_active_at}
            />
          }
        />

        <UserCard
          serverName={credentials.serverName}
          userId={session.attributes.user_id}
        />

        <Data.Grid>
          {session.attributes.device_id && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.legacy.device_id_label"
                  defaultMessage="Device ID"
                  description="Label for the device id field of a legacy device"
                />
              </Data.Title>
              <Data.Value className="break-all font-mono">
                {session.attributes.device_id}
              </Data.Value>
            </Data.Item>
          )}

          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.devices.legacy.created_at_label"
                defaultMessage="Signed in at"
                description="Label for the date a legacy device first signed in"
              />
            </Data.Title>
            <Data.Value>
              {computeHumanReadableDateTimeStringFromUtc(
                session.attributes.created_at,
              )}
            </Data.Value>
          </Data.Item>

          {session.attributes.last_active_at && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.legacy.last_active_label"
                  defaultMessage="Last active"
                  description="Label for the last-active date of a legacy device"
                />
              </Data.Title>
              <Data.Value>
                {computeHumanReadableDateTimeStringFromUtc(
                  session.attributes.last_active_at,
                )}
              </Data.Value>
            </Data.Item>
          )}

          {session.attributes.last_active_ip && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.legacy.last_active_ip_label"
                  defaultMessage="Last active IP"
                  description="Label for the last-active IP of a legacy device"
                />
              </Data.Title>
              <Data.Value>{session.attributes.last_active_ip}</Data.Value>
            </Data.Item>
          )}

          {session.attributes.finished_at && (
            <Data.Item>
              <Data.Title>
                <FormattedMessage
                  id="pages.devices.legacy.finished_at_label"
                  defaultMessage="Signed out at"
                  description="Label for the sign-out date of a legacy device"
                />
              </Data.Title>
              <Data.Value>
                {computeHumanReadableDateTimeStringFromUtc(
                  session.attributes.finished_at,
                )}
              </Data.Value>
            </Data.Item>
          )}
        </Data.Grid>

        {(session.attributes.user_agent || session.attributes.redirect_uri) && (
          <Disclosure
            summary={
              <FormattedMessage
                id="pages.devices.legacy.technical_details"
                defaultMessage="Technical details"
                description="Summary of the collapsed section with technical details (user agent, redirect URI) of a legacy device"
              />
            }
          >
            <Data.Grid>
              {session.attributes.redirect_uri && (
                <Data.Item>
                  <Data.Title>
                    <FormattedMessage
                      id="pages.devices.legacy.redirect_uri_label"
                      defaultMessage="Redirect URI"
                      description="Label for the redirect URI of a legacy device"
                    />
                  </Data.Title>
                  <Data.Value className="break-all">
                    {session.attributes.redirect_uri}
                  </Data.Value>
                </Data.Item>
              )}

              {session.attributes.user_agent && (
                <Data.Item>
                  <Data.Title>
                    <FormattedMessage
                      id="pages.devices.legacy.user_agent_label"
                      defaultMessage="User agent"
                      description="Label for the user-agent of a legacy device"
                    />
                  </Data.Title>
                  <Data.Value className="break-all">
                    {session.attributes.user_agent}
                  </Data.Value>
                </Data.Item>
              )}
            </Data.Grid>
          </Disclosure>
        )}

        {!finished && (
          <Dialog.Root
            open={open}
            onOpenChange={onOpenChange}
            trigger={
              <Button
                type="button"
                size="md"
                kind="secondary"
                destructive
                Icon={DeleteIcon}
              >
                <FormattedMessage
                  id="pages.devices.legacy.finish.button"
                  defaultMessage="Remove device"
                  description="Button label to remove (sign out) a legacy device"
                />
              </Button>
            }
          >
            <Dialog.Title>
              <FormattedMessage
                id="pages.devices.legacy.finish.title"
                defaultMessage="Remove this legacy device?"
                description="Title of the confirmation dialog when removing (signing out) a legacy device"
              />
            </Dialog.Title>
            <Dialog.Description>
              <FormattedMessage
                id="pages.devices.legacy.finish.description"
                defaultMessage="The user will be signed out of this device. Access and refresh tokens will be revoked immediately."
                description="Description of the confirmation dialog when signing out (finishing) a legacy device"
              />
            </Dialog.Description>
            <div className="flex flex-col gap-2">
              <StaticEntityCard>
                <UserCardBody
                  serverName={credentials.serverName}
                  userId={session.attributes.user_id}
                />
              </StaticEntityCard>
              <StaticEntityCard>
                <DeviceInfo
                  humanName={session.attributes.human_name}
                  userAgent={session.attributes.user_agent}
                  deviceId={session.attributes.device_id}
                  fallbackName={session.attributes.device_id}
                />
              </StaticEntityCard>
            </div>
            <Button
              type="button"
              kind="primary"
              destructive
              disabled={finishPending}
              onClick={handleConfirm}
              Icon={finishPending ? undefined : DeleteIcon}
            >
              {finishPending && <InlineSpinner />}
              <FormattedMessage
                id="pages.devices.legacy.finish.confirm"
                defaultMessage="Remove device"
                description="Confirmation button label for removing (signing out) a legacy device"
              />
            </Button>
            <Dialog.Close asChild>
              <Button type="button" kind="tertiary" disabled={finishPending}>
                <FormattedMessage {...messages.actionCancel} />
              </Button>
            </Dialog.Close>
          </Dialog.Root>
        )}
      </div>
    </Navigation.Details>
  );
}
