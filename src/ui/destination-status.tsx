// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import type { Destination } from "@/api/synapse";
import { assertNever } from "@/utils/never";
import {
  CheckCircleIcon,
  ErrorIcon,
  PauseIcon,
  WarningIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Badge } from "@vector-im/compound-web";
import { FormattedMessage } from "react-intl";

type DestinationStatus = "working" | "failing" | "inactive" | "never-worked";

export function getDestinationStatus(dest: Destination): DestinationStatus {
  if (dest.last_successful_stream_ordering === null) return "never-worked";
  if (dest.failure_ts === null) return "working";
  if (dest.retry_interval > 0) return "failing";
  return "inactive";
}

export function StatusBadge({ status }: { status: DestinationStatus }) {
  switch (status) {
    case "working": {
      return (
        <Badge kind="green" Icon={CheckCircleIcon}>
          <FormattedMessage
            id="ui.destination_status.working"
            defaultMessage="Working"
            description="Badge label for a federation destination that is working"
          />
        </Badge>
      );
    }
    case "failing": {
      return (
        <Badge kind="red" Icon={ErrorIcon}>
          <FormattedMessage
            id="ui.destination_status.failing"
            defaultMessage="Failing"
            description="Badge label for a federation destination that is failing"
          />
        </Badge>
      );
    }
    case "never-worked": {
      return (
        <Badge kind="grey" Icon={WarningIcon}>
          <FormattedMessage
            id="ui.destination_status.never_worked"
            defaultMessage="Never worked"
            description="Badge label for a federation destination that has never successfully received any data"
          />
        </Badge>
      );
    }
    case "inactive": {
      return (
        <Badge kind="grey" Icon={PauseIcon}>
          <FormattedMessage
            id="ui.destination_status.inactive"
            defaultMessage="Inactive"
            description="Badge label for a federation destination that is inactive"
          />
        </Badge>
      );
    }
    default: {
      return assertNever(status);
    }
  }
}
