// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Alert, Avatar, H3, Tooltip } from "@vector-im/compound-web";
import { Suspense, useMemo } from "react";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import { wellKnownQuery } from "@/api/matrix";
import { federationDestinationQuery } from "@/api/synapse";
import { serverSupportQuery } from "@/api/well-known-support";
import * as Data from "@/components/data";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import * as messages from "@/messages";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";
import { getDestinationStatus, StatusBadge } from "@/ui/destination-status";

export const Route = createFileRoute(
  "/_console/federation/known-domains/$destination",
)({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    await queryClient.ensureQueryData(
      federationDestinationQuery(synapseRoot, params.destination),
    );

    // Only prefetch a destination's own well-known once we know Synapse has
    // heard of it, so an arbitrary route param can't make the admin's browser
    // fetch an attacker-controlled host.
    queryClient.prefetchQuery(serverSupportQuery(params.destination));
  },

  component: RouteComponent,
  notFoundComponent: NotFoundComponent,
});

const detailsLabel = defineMessage({
  id: "pages.federation.details_label",
  defaultMessage: "Destination details",
  description:
    "The accessible name of the federation destination details panel",
});

function NotFoundComponent() {
  const { destination } = Route.useParams();
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
          id: "pages.federation.not_found.title",
          defaultMessage: "Destination not found",
          description:
            "The title of the alert when a federation destination could not be found",
        })}
      >
        <FormattedMessage
          id="pages.federation.not_found.description"
          defaultMessage="The requested destination ({destination}) could not be found."
          description="The description of the alert when a federation destination could not be found"
          values={{ destination }}
        />
      </Alert>
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
          to="/federation/known-domains"
          search={search}
          kind="tertiary"
          size="md"
          Icon={CloseIcon}
        />
      </Tooltip>
    </div>
  );
};

/** The last retry as a local datetime, or "Never" when Synapse has not had to
 * retry this destination. */
function FormattedLastRetry({ epochMs }: { epochMs: number }): React.ReactNode {
  if (epochMs <= 0) {
    return (
      <FormattedMessage
        id="pages.federation.detail.last_retry.never"
        defaultMessage="Never"
        description="Value shown for a federation destination's last retry timestamp when it has never been retried"
      />
    );
  }
  return computeHumanReadableDateTimeStringFromUtc(
    new Date(epochMs).toISOString(),
  );
}

/** A backoff interval as a duration, or "None" when there is no backoff — which
 * is the healthy state, not a fault. */
function FormattedDuration({ ms }: { ms: number }): React.ReactNode {
  const intl = useIntl();
  const formatter = useMemo(
    () => new Intl.DurationFormat(intl.locale),
    [intl.locale],
  );

  if (ms <= 0) {
    return (
      <FormattedMessage
        id="pages.federation.detail.retry_interval.none"
        defaultMessage="None"
        description="Value shown for a federation destination's retry interval when there is no backoff, which is the case for a destination that is working"
      />
    );
  }

  return formatter.format({
    milliseconds: ms % 1000,
    seconds: Math.floor(ms / 1000) % 60,
    minutes: Math.floor(ms / (60 * 1000)) % 60,
    hours: Math.floor(ms / (60 * 60 * 1000)) % 24,
    days: Math.floor(ms / (24 * 60 * 60 * 1000)) % 365,
    years: Math.floor(ms / (365 * 24 * 60 * 60 * 1000)),
  });
}

/** Render a contact value as a clickable link (mailto: for emails, matrix.to for MXIDs) */
function ContactValue({ value }: { value: string }) {
  const href = value.startsWith("@")
    ? `https://matrix.to/#/${encodeURIComponent(value)}`
    : `mailto:${value}`;

  return (
    <Data.Value>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-link-primary hover:underline truncate"
      >
        {value}
      </a>
    </Data.Value>
  );
}

function ContactInfo({ destination }: { destination: string }) {
  const { data: support } = useQuery(serverSupportQuery(destination));

  if (!support) return null;

  const hasContacts = support.contacts && support.contacts.length > 0;
  const hasSupportPage = Boolean(support.support_page);

  if (!hasContacts && !hasSupportPage) return null;

  const adminContact = support.contacts?.find((c) => c.role === "m.role.admin");
  const securityContact = support.contacts?.find(
    (c) => c.role === "m.role.security",
  );

  const contactValue = adminContact?.email_address || adminContact?.matrix_id;
  const securityValue =
    securityContact?.email_address || securityContact?.matrix_id;

  return (
    <>
      {contactValue && (
        <Data.Item>
          <Data.Title>
            <FormattedMessage
              id="pages.federation.detail.contact"
              defaultMessage="Contact"
              description="Label for the contact email of a federation destination"
            />
          </Data.Title>
          <ContactValue value={contactValue} />
        </Data.Item>
      )}
      {securityValue && (
        <Data.Item>
          <Data.Title>
            <FormattedMessage
              id="pages.federation.detail.security"
              defaultMessage="Security"
              description="Label for the security contact of a federation destination"
            />
          </Data.Title>
          <ContactValue value={securityValue} />
        </Data.Item>
      )}
      {support.support_page && (
        <Data.Item>
          <Data.Title>
            <FormattedMessage
              id="pages.federation.detail.support_page"
              defaultMessage="Support page"
              description="Label for the support page URL of a federation destination"
            />
          </Data.Title>
          <Data.Value>
            <a
              href={support.support_page}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-link-primary hover:underline truncate block"
            >
              {support.support_page}
            </a>
          </Data.Value>
        </Data.Item>
      )}
    </>
  );
}

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const { destination: destinationName } = Route.useParams();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const { data: dest } = useSuspenseQuery(
    federationDestinationQuery(synapseRoot, destinationName),
  );

  const status = getDestinationStatus(dest);

  const intl = useIntl();

  return (
    <Navigation.Details aria-label={intl.formatMessage(detailsLabel)}>
      <CloseSidebar />

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4 items-center">
          <Avatar
            id={destinationName}
            name={destinationName}
            type="square"
            size="88px"
          />

          <div className="flex flex-col gap-3 items-center text-center min-w-0 w-full">
            <H3 className="truncate max-w-full">{destinationName}</H3>
            <StatusBadge status={status} />
          </div>
        </div>

        <Data.Grid>
          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.federation.detail.last_retry"
                defaultMessage="Last retry timestamp"
                description="Label for the last retry timestamp of a federation destination"
              />
            </Data.Title>
            <Data.Value>
              <FormattedLastRetry epochMs={dest.retry_last_ts} />
            </Data.Value>
          </Data.Item>

          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.federation.detail.retry_interval"
                defaultMessage="Retry interval"
                description="Label for the retry interval of a federation destination"
              />
            </Data.Title>
            <Data.Value>
              <FormattedDuration ms={dest.retry_interval} />
            </Data.Value>
          </Data.Item>

          <Data.Item>
            <Data.Title>
              <FormattedMessage
                id="pages.federation.detail.last_successful_stream"
                defaultMessage="Last successful stream"
                description="Label for the last successful stream ordering of a federation destination"
              />
            </Data.Title>
            {dest.last_successful_stream_ordering === null ? (
              // oxlint-disable-next-line formatjs/no-literal-string-in-jsx
              <Data.Value>—</Data.Value>
            ) : (
              <Data.NumericValue value={dest.last_successful_stream_ordering} />
            )}
          </Data.Item>

          <Suspense>
            <ContactInfo destination={destinationName} />
          </Suspense>
        </Data.Grid>
      </div>
    </Navigation.Details>
  );
}
