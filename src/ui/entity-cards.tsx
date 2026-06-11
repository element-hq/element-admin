// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";

import { oauth2ClientQuery, userQuery } from "@/api/mas";
import { wellKnownQuery } from "@/api/matrix";
import { ClientInfo } from "@/components/client-info";
import { EntityCard, EntityCardSkeleton } from "@/components/entity-card";
import * as Placeholder from "@/components/placeholder";
import { UserInfo } from "@/components/room-info";

interface UserCardProps {
  serverName: string;
  userId: string;
}

// Same shape as the resolved body, so the card it sits in doesn't resize once
// the user is loaded
const UserCardBodySkeleton = () => (
  <div aria-busy="true" className="flex items-center gap-3 min-w-0">
    <Placeholder.Avatar />
    <div className="flex flex-col gap-1 flex-1 max-w-60">
      <Placeholder.Text />
    </div>
  </div>
);

const UserCardBodyInner: React.FC<UserCardProps> = ({
  serverName,
  userId,
}: UserCardProps) => {
  const { data: wellKnown } = useSuspenseQuery(wellKnownQuery(serverName));
  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const {
    data: { data: user },
  } = useSuspenseQuery(userQuery(serverName, userId));
  const mxid = `@${user.attributes.username}:${serverName}`;

  return <UserInfo synapseRoot={synapseRoot} mxid={mxid} />;
};

// The contents of a user card: avatar, display name and Matrix ID, all resolved
// from the MAS user ID. Compose it inside a `StaticEntityCard` to show a user
// for context (e.g. in a confirmation dialog) without linking anywhere; use
// `UserCard` to link to the user's detail page.
export const UserCardBody: React.FC<UserCardProps> = (props: UserCardProps) => (
  <Suspense fallback={<UserCardBodySkeleton />}>
    <UserCardBodyInner {...props} />
  </Suspense>
);

// A card showing a user's avatar, display name and Matrix ID, linking to their
// detail page. The link target only depends on the user ID, so the card itself
// renders right away and only its body waits for the queries.
export const UserCard: React.FC<UserCardProps> = ({
  serverName,
  userId,
}: UserCardProps) => (
  <EntityCard
    to="/users/$userId"
    params={{ userId }}
    search={{ status: "active" }}
    resetScroll={false}
  >
    <UserCardBody serverName={serverName} userId={userId} />
  </EntityCard>
);

interface ClientCardProps {
  serverName: string;
  clientId: string;
}

const ClientCardInner: React.FC<ClientCardProps> = ({
  serverName,
  clientId,
}: ClientCardProps) => {
  const {
    data: { data: client },
  } = useSuspenseQuery(oauth2ClientQuery(serverName, clientId));

  return (
    <EntityCard
      to="/devices/applications/$clientId"
      params={{ clientId }}
      search={{ hasActiveSessions: true }}
      resetScroll={false}
    >
      <ClientInfo client={client.attributes} />
    </EntityCard>
  );
};

// A card showing an application's logo, name and homepage, linking to its
// detail page. Fetches everything it needs from the client ID, and shows a
// card-shaped placeholder while loading.
export const ClientCard: React.FC<ClientCardProps> = (
  props: ClientCardProps,
) => (
  <Suspense fallback={<EntityCardSkeleton />}>
    <ClientCardInner {...props} />
  </Suspense>
);
