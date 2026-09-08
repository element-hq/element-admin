// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { type IntlShape, defineMessage } from "react-intl";

import type { SingleResourceForPersonalSession } from "@/api/mas/api/types.gen";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

const neverExpires = defineMessage({
  id: "pages.personal_tokens.never_expires",
  defaultMessage: "Never expires",
  description: "Text shown when a token has no expiration date",
});

const revoked = defineMessage({
  id: "pages.personal_tokens.expiry_revoked",
  defaultMessage: "Revoked",
  description: "Text shown in place of the expiry of a revoked token",
});

// MAS drops the token of a revoked session, so its `expires_at` is null like a
// token that never expires.
export const personalTokenExpiryText = (
  intl: IntlShape,
  token: SingleResourceForPersonalSession["attributes"],
): string => {
  if (token.revoked_at) return intl.formatMessage(revoked);
  if (token.expires_at)
    return computeHumanReadableDateTimeStringFromUtc(token.expires_at);
  return intl.formatMessage(neverExpires);
};
