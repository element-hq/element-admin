// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useMutation } from "@tanstack/react-query";
import { CopyIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { IconButton } from "@vector-im/compound-web";

import { useRowTabIndex } from "./data-table";

interface Props {
  value: string;
}

export const CopyToClipboard: React.FC<Props> = ({ value }: Props) => {
  const copyMutation = useMutation({
    mutationFn: () => navigator.clipboard.writeText(value),
    onSuccess: () => setTimeout(() => copyMutation.reset(), 2000),
  });

  // Joins the roving tabindex when rendered in a data table row, so the row it
  // sits in doesn't become an extra tab stop. Outside a row this is always 0.
  const tabIndex = useRowTabIndex();

  return (
    <IconButton
      tabIndex={tabIndex}
      disabled={copyMutation.isSuccess}
      onClick={() => copyMutation.mutate()}
      tooltip={copyMutation.isSuccess ? "Copied!" : "Copy to clipboard"}
    >
      <CopyIcon />
    </IconButton>
  );
};
