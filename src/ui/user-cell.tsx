// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useSuspenseQuery } from "@tanstack/react-query";
import { Text } from "@vector-im/compound-web";
import { type ReactNode, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { oauth2ClientQuery, userQuery } from "@/api/mas";
import { wellKnownQuery } from "@/api/matrix";
import { ClientInfo } from "@/components/client-info";
import * as Placeholder from "@/components/placeholder";
import { UserInfo } from "@/components/room-info";

// Loading and failure envelope for a table cell which resolves an identifier
// through the API. `ensureNoError` only turns 404s into notFound(), so any
// other status re-throws out of the queryFn — without a boundary here a single
// unresolvable row would unmount the entire table into the route's error
// component. Degrade to the bare identifier instead.
const CellBoundary: React.FC<{ fallback: string; children: ReactNode }> = ({
  fallback,
  children,
}) => (
  <ErrorBoundary
    fallback={
      <Text size="sm" className="text-text-secondary truncate font-mono">
        {fallback}
      </Text>
    }
  >
    <Suspense fallback={<Placeholder.LoadingText />}>{children}</Suspense>
  </ErrorBoundary>
);

const UserCellInner: React.FC<{ serverName: string; userId: string }> = ({
  serverName,
  userId,
}) => {
  const { data: wellKnown } = useSuspenseQuery(wellKnownQuery(serverName));
  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const {
    data: { data: user },
  } = useSuspenseQuery(userQuery(serverName, userId));
  const mxid = `@${user.attributes.username}:${serverName}`;
  return <UserInfo synapseRoot={synapseRoot} mxid={mxid} />;
};

// "Avatar + display name + mxid" for a MAS user ID, for use in table rows.
export const UserCell: React.FC<{ serverName: string; userId: string }> = ({
  serverName,
  userId,
}) => (
  <CellBoundary fallback={userId}>
    <UserCellInner serverName={serverName} userId={userId} />
  </CellBoundary>
);

const ClientCellInner: React.FC<{ serverName: string; clientId: string }> = ({
  serverName,
  clientId,
}) => {
  const {
    data: { data: client },
  } = useSuspenseQuery(oauth2ClientQuery(serverName, clientId));
  return <ClientInfo client={client.attributes} />;
};

// "Logo + name" for an OAuth 2.0 client ID, for use in table rows.
export const ClientCell: React.FC<{ serverName: string; clientId: string }> = ({
  serverName,
  clientId,
}) => (
  <CellBoundary fallback={clientId}>
    <ClientCellInner serverName={serverName} clientId={clientId} />
  </CellBoundary>
);
