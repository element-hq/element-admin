// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  DocumentIcon,
  HomeIcon,
  KeyIcon,
  LeaveIcon,
  UserProfileIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { FormattedMessage } from "react-intl";

import * as Navigation from "@/components/navigation";

const AppNavigation = () => (
  <Navigation.Sidebar>
    <Navigation.NavLink Icon={HomeIcon} to="/">
      <FormattedMessage
        id="navigation.dashboard"
        defaultMessage="Dashboard"
        description="Label for the dashboard navigation item in the main navigation sidebar"
      />
    </Navigation.NavLink>
    <Navigation.NavLink Icon={UserProfileIcon} to="/users">
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
    <Navigation.Divider />
    <Navigation.NavLink Icon={KeyIcon} to="/registration-tokens">
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
