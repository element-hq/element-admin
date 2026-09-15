// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { Form } from "@vector-im/compound-web";
import { FormattedMessage, type IntlShape, defineMessage } from "react-intl";

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

// Arbitrary: what the dialogs suggest when the token itself says nothing.
export const DEFAULT_EXPIRY_DAYS = 30;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Regenerating a token can only set a new duration, so a token with time left
// is offered the days it has left rather than the duration it was created with,
// rounded up so that regenerating never shortens it. An expiry already in the
// past, or one nothing can parse, has no days to offer.
export const daysUntilExpiry = (
  expiresAt: string | null | undefined,
): number | null => {
  const expiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (Number.isNaN(expiry)) return null;
  const days = Math.ceil((expiry - Date.now()) / DAY_IN_MS);
  return days > 0 ? days : null;
};

interface TokenExpiryFieldProps {
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  defaultDays: number;
}

// A personal session with no `expires_in` gets a token that never expires, both
// when creating and when regenerating, so the choice is a checkbox rather than
// an empty number field.
export const TokenExpiryField: React.FC<TokenExpiryFieldProps> = ({
  checked,
  onChange,
  defaultDays,
}) => (
  <>
    <Form.InlineField
      name="expires"
      control={<Form.CheckboxControl checked={checked} onChange={onChange} />}
    >
      <Form.Label>
        <FormattedMessage
          id="pages.personal_tokens.set_expiry_label"
          defaultMessage="Set an expiry"
          description="Label for the checkbox enabling a token expiry"
        />
      </Form.Label>
      <Form.HelpMessage>
        <FormattedMessage
          id="pages.personal_tokens.set_expiry_help"
          defaultMessage="Otherwise the token never expires"
          description="Help text for the checkbox enabling a token expiry"
        />
      </Form.HelpMessage>
    </Form.InlineField>

    {checked && (
      <Form.Field name="expires_in_days" serverInvalid={false}>
        <Form.Label>
          <FormattedMessage
            id="pages.personal_tokens.expires_in_label"
            defaultMessage="Expires in (days)"
            description="Label for the expiry field"
          />
        </Form.Label>
        <Form.TextControl
          type="number"
          min="1"
          required
          defaultValue={defaultDays}
        />
        <Form.ErrorMessage match="valueMissing">
          <FormattedMessage
            id="pages.personal_tokens.expires_in_missing"
            defaultMessage="Enter how many days the token should last"
            description="Error shown when the expiry field is left empty"
          />
        </Form.ErrorMessage>
        <Form.ErrorMessage match="rangeUnderflow">
          <FormattedMessage
            id="pages.personal_tokens.expires_in_underflow"
            defaultMessage="A token has to last at least one day"
            description="Error shown when the expiry field is set below one day"
          />
        </Form.ErrorMessage>
      </Form.Field>
    )}
  </>
);
