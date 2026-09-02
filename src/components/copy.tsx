// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useMutation } from "@tanstack/react-query";
import {
  CheckIcon,
  CopyIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { IconButton, Tooltip } from "@vector-im/compound-web";
import { defineMessage, useIntl } from "react-intl";

import { useRowTabIndex } from "./data-table";

const labelCopy = defineMessage({
  id: "ui.copy.copy_to_clipboard",
  defaultMessage: "Copy to clipboard",
  description: "Tooltip on the button which copies a value to the clipboard",
});
const labelCopied = defineMessage({
  id: "ui.copy.copied",
  defaultMessage: "Copied!",
  description:
    "Tooltip on the copy button just after the value was copied to the clipboard",
});

interface Props {
  value: string;
}

export const CopyToClipboard: React.FC<Props> = ({ value }: Props) => {
  const intl = useIntl();
  const copyMutation = useMutation({
    mutationFn: () => navigator.clipboard.writeText(value),
    onSuccess: () => setTimeout(() => copyMutation.reset(), 2000),
  });

  // Joins the roving tabindex when rendered in a data table row, so the row it
  // sits in doesn't become an extra tab stop. Outside a row this is always 0.
  const tabIndex = useRowTabIndex();

  // The button's accessible name stays "Copy to clipboard"; the copied state is
  // announced through the `output` element, which screen readers treat as a
  // status region. The button stays enabled while it shows that state, because
  // disabling it would move focus to the body for the two seconds it takes to
  // reset.
  return (
    <>
      <Tooltip
        description={intl.formatMessage(
          copyMutation.isSuccess ? labelCopied : labelCopy,
        )}
      >
        <IconButton
          aria-label={intl.formatMessage(labelCopy)}
          tabIndex={tabIndex}
          onClick={() => copyMutation.mutate()}
        >
          {copyMutation.isSuccess ? <CheckIcon /> : <CopyIcon />}
        </IconButton>
      </Tooltip>

      <output className="sr-only">
        {copyMutation.isSuccess ? intl.formatMessage(labelCopied) : ""}
      </output>
    </>
  );
};
