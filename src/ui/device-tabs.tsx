// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useSearch } from "@tanstack/react-router";
import { FormattedMessage, useIntl } from "react-intl";

import * as SubTabs from "@/components/sub-tabs";

// Default ordering applied when landing on the devices tabs, both through the
// main navigation (the /devices redirect) and through the tab bar: newest
// first. Devices from statically-registered applications (like the admin
// console itself) are hidden everywhere, so there is no client-kind filter to
// default here.
export const defaultUserDevicesSearch = {
  dir: "backward",
} as const;

export const defaultLegacyDevicesSearch = {
  dir: "backward",
} as const;

export const DeviceTabs: React.FC = () => {
  // Both the user devices and legacy devices tabs can be filtered by user;
  // keep that filter when switching between them
  const { user } = useSearch({ strict: false });
  const intl = useIntl();

  return (
    <SubTabs.Root
      aria-label={intl.formatMessage({
        id: "pages.devices.tabs.section",
        defaultMessage: "Device views",
        description: "The label for the devices tabs section",
      })}
    >
      <SubTabs.Tab
        to="/devices/user"
        search={{ ...defaultUserDevicesSearch, user }}
        activeOptions={{ includeSearch: false }}
      >
        <FormattedMessage
          id="pages.devices.tabs.user"
          defaultMessage="User devices"
          description="Label for the user-devices tab on the Devices page"
        />
      </SubTabs.Tab>
      <SubTabs.Tab
        to="/devices/applications"
        search={{ hasActiveSessions: true }}
        activeOptions={{ includeSearch: false }}
      >
        <FormattedMessage
          id="pages.devices.tabs.applications"
          defaultMessage="Applications"
          description="Label for the applications tab on the Devices page"
        />
      </SubTabs.Tab>
      <SubTabs.Tab
        to="/devices/legacy"
        search={{ ...defaultLegacyDevicesSearch, user }}
        activeOptions={{ includeSearch: false }}
      >
        <FormattedMessage
          id="pages.devices.tabs.legacy"
          defaultMessage="Legacy devices"
          description="Label for the legacy-devices tab on the Devices page"
        />
      </SubTabs.Tab>
    </SubTabs.Root>
  );
};
