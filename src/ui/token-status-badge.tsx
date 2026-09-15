// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { Badge } from "@vector-im/compound-web";
import { defineMessage, useIntl } from "react-intl";

import type { SingleResourceForPersonalSession } from "@/api/mas/api/types.gen";

const registrationActive = defineMessage({
  id: "pages.registration_tokens.status.active",
  defaultMessage: "Active",
  description: "Registration token status: active",
});
const registrationRevoked = defineMessage({
  id: "pages.registration_tokens.status.revoked",
  defaultMessage: "Revoked",
  description: "Registration token status: revoked",
});
const registrationExpired = defineMessage({
  id: "pages.registration_tokens.status.expired",
  defaultMessage: "Expired",
  description: "Registration token status: expired",
});
const registrationUsedUp = defineMessage({
  id: "pages.registration_tokens.status.used_up",
  defaultMessage: "Used up",
  description: "Registration token status: used up",
});
const registrationInvalid = defineMessage({
  id: "pages.registration_tokens.status.invalid",
  defaultMessage: "Invalid",
  description: "Registration token status: invalid",
});

const personalActive = defineMessage({
  id: "pages.personal_tokens.status.active",
  defaultMessage: "Active",
  description: "Status badge for active personal tokens",
});
const personalRevoked = defineMessage({
  id: "pages.personal_tokens.status.revoked",
  defaultMessage: "Revoked",
  description: "Status badge for revoked personal tokens",
});
const personalExpired = defineMessage({
  id: "pages.personal_tokens.status.expired",
  defaultMessage: "Expired",
  description: "Status badge for expired personal tokens",
});

// An expiry nothing can parse counts as past, so a token the server says is
// expired never reads as "Active".
const hasExpired = (expiresAt: string | null | undefined): boolean => {
  if (!expiresAt) return false;
  const expiry = Date.parse(expiresAt);
  return Number.isNaN(expiry) || expiry <= Date.now();
};

interface RegistrationTokenStatusBadgeProps {
  token: {
    valid: boolean;
    expires_at?: string | null;
    usage_limit?: number | null;
    times_used: number;
    revoked_at?: string | null;
  };
}

// Revoked, used up and expired are normal ends of life, so they are grey like a
// signed-out device; red is kept for a token the server rejects for a reason
// none of the attributes explain.
// The attribute checks come before the server-computed `valid`, so the next
// render after a token expires tells the truth rather than waiting for the
// server to recompute the flag.
export const RegistrationTokenStatusBadge: React.FC<
  RegistrationTokenStatusBadgeProps
> = ({ token }) => {
  const intl = useIntl();

  if (token.revoked_at) {
    return <Badge kind="grey">{intl.formatMessage(registrationRevoked)}</Badge>;
  }

  if (hasExpired(token.expires_at)) {
    return <Badge kind="grey">{intl.formatMessage(registrationExpired)}</Badge>;
  }

  if (
    token.usage_limit !== null &&
    token.usage_limit !== undefined &&
    token.times_used >= token.usage_limit
  ) {
    return <Badge kind="grey">{intl.formatMessage(registrationUsedUp)}</Badge>;
  }

  if (!token.valid) {
    return <Badge kind="red">{intl.formatMessage(registrationInvalid)}</Badge>;
  }

  return <Badge kind="green">{intl.formatMessage(registrationActive)}</Badge>;
};

interface PersonalTokenStatusBadgeProps {
  token: SingleResourceForPersonalSession["attributes"];
}

// Same palette as the registration token badge.
export const PersonalTokenStatusBadge: React.FC<
  PersonalTokenStatusBadgeProps
> = ({ token }) => {
  const intl = useIntl();

  if (token.revoked_at) {
    return <Badge kind="grey">{intl.formatMessage(personalRevoked)}</Badge>;
  }

  if (hasExpired(token.expires_at)) {
    return <Badge kind="grey">{intl.formatMessage(personalExpired)}</Badge>;
  }

  return <Badge kind="green">{intl.formatMessage(personalActive)}</Badge>;
};
