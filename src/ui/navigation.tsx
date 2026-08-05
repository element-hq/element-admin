// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  AdminIcon,
  CloudIcon,
  DevicesIcon,
  DocumentIcon,
  ExportArchiveIcon,
  HomeIcon,
  InlineCodeIcon,
  KeyIcon,
  LeaveIcon,
  UserProfileIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { FormattedMessage } from "react-intl";

import * as Navigation from "@/components/navigation";
import type { MasFeaturesStatus } from "@/utils/features";

const AppNavigation = ({ features }: { features: MasFeaturesStatus }) => (
  <Navigation.Sidebar>
    <Navigation.NavLink Icon={HomeIcon} to="/">
      <FormattedMessage
        id="navigation.dashboard"
        defaultMessage="Dashboard"
        description="Label for the dashboard navigation item in the main navigation sidebar"
      />
    </Navigation.NavLink>
    <Navigation.NavLink
      Icon={UserProfileIcon}
      to="/users"
      search={{ status: "active" }}
      activeOptions={{ includeSearch: false }}
    >
      <FormattedMessage
        id="navigation.users"
        defaultMessage="Users"
        description="Label for the users navigation item in the main navigation sidebar"
      />
    </Navigation.NavLink>
    <Navigation.NavLink Icon={LeaveIcon} to="/rooms">
      <FormattedMessage
        id="navigation.rooms"
        defaultMessage="Rooms"
        description="Label for the rooms navigation item in the main navigation sidebar"
      />
    </Navigation.NavLink>
    {features.devices && (
      <Navigation.NavLink Icon={DevicesIcon} to="/devices">
        <FormattedMessage
          id="navigation.devices"
          defaultMessage="Devices"
          description="Label for the devices navigation item in the main navigation sidebar"
        />
      </Navigation.NavLink>
    )}
    <Navigation.NavLink Icon={CloudIcon} to="/federation">
      <FormattedMessage
        id="navigation.federation"
        defaultMessage="Federation"
        description="Label for the federation navigation item in the main navigation sidebar"
      />
    </Navigation.NavLink>
    <Navigation.Divider />
    <Navigation.NavLink Icon={ExportArchiveIcon} to="/auditing">
      <FormattedMessage
        id="navigation.auditing"
        defaultMessage="Auditing"
        description="Label for the auditing navigation item in the main navigation sidebar"
      />
    </Navigation.NavLink>
    <Navigation.NavLink Icon={AdminIcon} to="/supervision">
      <FormattedMessage
        id="navigation.supervision"
        defaultMessage="Supervision"
        description="Label for the supervision navigation item in the main navigation sidebar"
      />
    </Navigation.NavLink>
    <Navigation.Divider />
    {features.personalTokens && (
      <Navigation.NavLink
        Icon={InlineCodeIcon}
        to="/personal-tokens"
        search={{ status: "active" }}
        activeOptions={{ includeSearch: false }}
      >
        <FormattedMessage
          id="navigation.personal_tokens"
          defaultMessage="Personal tokens"
          description="Label for the personal tokens navigation item in the main navigation sidebar"
        />
      </Navigation.NavLink>
    )}
    <Navigation.NavLink
      Icon={KeyIcon}
      to="/registration-tokens"
      search={{ revoked: false }}
      activeOptions={{ includeSearch: false }}
    >
      <FormattedMessage
        id="navigation.registration_tokens"
        defaultMessage="Registration tokens"
        description="Label for the registration tokens navigation item in the main navigation sidebar"
      />
    </Navigation.NavLink>
    <Navigation.Divider />
    <Navigation.NavAnchor
      Icon={DocumentIcon}
      href="https://docs.element.io/"
      target="_blank"
      rel="noopener noreferrer"
    >
      <FormattedMessage
        id="navigation.documentation"
        defaultMessage="Documentation"
        description="Label for the documentation navigation link (to https://docs.element.io/) in the main navigation sidebar"
      />
    </Navigation.NavAnchor>
  </Navigation.Sidebar>
);

export default AppNavigation;
