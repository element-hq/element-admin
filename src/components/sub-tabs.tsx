// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import { createLink, type LinkProps } from "@tanstack/react-router";

import { NavBar, NavItem } from "@vector-im/compound-web";

export const Root = NavBar;

const BaseTab = createLink(NavItem);

// Small wrapper around the Compound <NavItem> component to behave as Tanstack Router link
export const Tab = (
  props: Omit<LinkProps, "activeProps" | "inactiveProps">,
) => (
  <BaseTab
    activeProps={{ active: true }}
    inactiveProps={{ active: false }}
    {...props}
  />
);
