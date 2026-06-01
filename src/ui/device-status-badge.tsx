// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { Badge, Tooltip } from "@vector-im/compound-web";
import { useState } from "react";
import { defineMessage, useIntl } from "react-intl";

import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";
import {
  type ActivityCutoffs,
  activityCutoffs,
  deviceActivityStatus,
} from "@/utils/device-activity";

// Compute the activity cutoffs once per mount. "now" is point-in-time and
// lazily initialised so react-compiler treats it as a stable value.
export const useActivityCutoffs = (): ActivityCutoffs => {
  const [cutoffs] = useState(() => activityCutoffs(Date.now()));
  return cutoffs;
};

const labelSignedOut = defineMessage({
  id: "ui.device_status.signed_out",
  defaultMessage: "Signed out",
  description: "Device status badge: the device has been signed out",
});
const labelNeverUsed = defineMessage({
  id: "ui.device_status.never_used",
  defaultMessage: "Never used",
  description: "Device status badge: the device has never been used",
});
const labelInactive = defineMessage({
  id: "ui.device_status.inactive",
  defaultMessage: "Inactive",
  description:
    "Device status badge: the device has not been used in a long time",
});
const labelRecentlyUsed = defineMessage({
  id: "ui.device_status.recently_used",
  defaultMessage: "Recently used",
  description:
    "Device status badge: the device was used in the last couple of weeks",
});
const labelActive = defineMessage({
  id: "ui.device_status.active",
  defaultMessage: "Active",
  description:
    "Device status badge: the device is signed in and was used in the last few months",
});

const tooltipSignedOutAt = defineMessage({
  id: "ui.device_status.signed_out.tooltip_at",
  defaultMessage: "Signed out on {date}.",
  description:
    "Tooltip on the 'Signed out' device status badge, giving the date it was signed out",
});
const tooltipSignedOut = defineMessage({
  id: "ui.device_status.signed_out.tooltip",
  defaultMessage: "This device has been signed out and no longer has access.",
  description:
    "Tooltip on the 'Signed out' device status badge, when the date is unknown",
});
const tooltipNeverUsed = defineMessage({
  id: "ui.device_status.never_used.tooltip",
  defaultMessage: "This device has not been used yet.",
  description: "Tooltip on the 'Never used' device status badge",
});
const tooltipLastActive = defineMessage({
  id: "ui.device_status.last_active.tooltip",
  defaultMessage: "Last active on {date}.",
  description:
    "Tooltip on a device status badge, giving the date the device was last active",
});

interface DeviceStatusBadgeProps {
  finishedAt?: string | null;
  lastActiveAt?: string | null;
  // List pages pass one value shared by every row so all badges agree on
  // "now"; detail panes can omit it and let the badge derive its own.
  cutoffs?: ActivityCutoffs;
}

// Activity badge for a device (OAuth 2.0 session or compatibility session),
// derived from when it was last active and whether it has been signed out.
// The badge text is the state; the tooltip carries the actual date, which is
// the only place the device lists surface it.
export const DeviceStatusBadge: React.FC<DeviceStatusBadgeProps> = ({
  finishedAt,
  lastActiveAt,
  cutoffs,
}) => {
  const intl = useIntl();
  const ownCutoffs = useActivityCutoffs();
  const effectiveCutoffs = cutoffs ?? ownCutoffs;

  // Formatting throws on an unparseable timestamp, so guard rather than trust
  // the API's string. A device with no usable date is "never used" anyway.
  const lastActiveDate =
    lastActiveAt && !Number.isNaN(Date.parse(lastActiveAt))
      ? computeHumanReadableDateTimeStringFromUtc(lastActiveAt)
      : undefined;
  const lastActiveTooltip = lastActiveDate
    ? intl.formatMessage(tooltipLastActive, { date: lastActiveDate })
    : intl.formatMessage(tooltipNeverUsed);

  let kind: "grey" | "green" | "blue";
  let label: string;
  let tooltip: string;
  switch (
    deviceActivityStatus({ finishedAt, lastActiveAt }, effectiveCutoffs)
  ) {
    case "signed-out": {
      kind = "grey";
      label = intl.formatMessage(labelSignedOut);
      tooltip =
        finishedAt && !Number.isNaN(Date.parse(finishedAt))
          ? intl.formatMessage(tooltipSignedOutAt, {
              date: computeHumanReadableDateTimeStringFromUtc(finishedAt),
            })
          : intl.formatMessage(tooltipSignedOut);
      break;
    }
    case "never-used": {
      kind = "grey";
      label = intl.formatMessage(labelNeverUsed);
      tooltip = intl.formatMessage(tooltipNeverUsed);
      break;
    }
    case "inactive": {
      kind = "grey";
      label = intl.formatMessage(labelInactive);
      tooltip = lastActiveTooltip;
      break;
    }
    case "recently-used": {
      kind = "green";
      label = intl.formatMessage(labelRecentlyUsed);
      tooltip = lastActiveTooltip;
      break;
    }
    // "active": signed in and used within the last few months (the residual
    // bucket between "recently used" and "inactive").
    default: {
      kind = "blue";
      label = intl.formatMessage(labelActive);
      tooltip = lastActiveTooltip;
    }
  }

  // `description` rather than `label`: compound's Tooltip turns `label` into
  // the trigger's aria-label, which would replace the badge's own text as its
  // accessible name (WCAG 2.5.3). The badge stays focusable so keyboard and
  // screen-reader users can still reach the date, which no column shows.
  return (
    <Tooltip description={tooltip} isTriggerInteractive={false}>
      <Badge kind={kind}>{label}</Badge>
    </Tooltip>
  );
};
