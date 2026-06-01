// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { Avatar, Text } from "@vector-im/compound-web";

import type { OAuth2Client } from "@/api/mas/api/types.gen";

interface ClientInfoProps {
  client: OAuth2Client;
  size?: "32px" | "64px";
}

// Compact "logo + name + uri" block for an OAuth 2.0 client (a.k.a.
// "application"), suitable for table rows and detail headers.
export const ClientInfo: React.FC<ClientInfoProps> = ({
  client,
  size = "32px",
}: ClientInfoProps) => {
  const name = client.client_name ?? client.client_id;
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar
        id={client.client_id}
        name={name}
        src={client.logo_uri ?? undefined}
        size={size}
        type="square"
        className="shrink-0"
      />
      <div className="flex flex-col min-w-0">
        <Text
          size="md"
          weight="semibold"
          className="text-text-primary truncate"
        >
          {name}
        </Text>
        {client.client_uri && (
          <Text size="sm" className="text-text-secondary truncate">
            {client.client_uri}
          </Text>
        )}
      </div>
    </div>
  );
};
