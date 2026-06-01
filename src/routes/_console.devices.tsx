// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import {
  defineMessage,
  FormattedMessage,
  type MessageDescriptor,
} from "react-intl";

import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Placeholder from "@/components/placeholder";
import { DeviceTabs } from "@/ui/device-tabs";
import AppFooter from "@/ui/footer";
import { getFeaturesStatus } from "@/utils/features";

const titleMessage = defineMessage({
  id: "pages.devices.title",
  defaultMessage: "Devices",
  description: "The title of the Devices section",
});

interface TabHeadingProps {
  title: MessageDescriptor;
  description: MessageDescriptor;
}

/**
 * Common "heading" part shared by every tab of the Devices section: the tab
 * bar plus that tab's own title and description.
 */
export const Heading: React.FC<
  TabHeadingProps & {
    // Has to be rendered *inside* Page.Header: page.module.css lays the search
    // box out as a grid sibling of the title (`.header:has(.search)`).
    search?: React.ReactNode;
  }
> = ({ title, description, search }) => (
  <>
    <DeviceTabs />
    <Page.Header>
      <Page.Title>
        <FormattedMessage {...title} />
      </Page.Title>
      <Page.Description>
        <FormattedMessage {...description} />
      </Page.Description>
      {search}
    </Page.Header>
  </>
);

/**
 * Loading shell for a device tab. It renders the same heading as the loaded
 * page, so switching tabs doesn't flash a title-less tab bar and then reflow
 * once the real component mounts.
 */
export const PendingTab: React.FC<TabHeadingProps> = ({
  title,
  description,
}) => (
  <>
    <Outlet />

    <Navigation.Content>
      <Navigation.Main>
        <Heading title={title} description={description} />
        <Placeholder.LoadingTable />
      </Navigation.Main>

      <AppFooter />
    </Navigation.Content>
  </>
);

export const Route = createFileRoute("/_console/devices")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },
  // The whole section relies on MAS endpoints which only exist from 1.20. The
  // navigation entry is hidden on older servers, but this route is also
  // reachable by deep link, so guard it here rather than letting the list
  // queries fail with a raw API error.
  beforeLoad: async ({ context: { queryClient, credentials } }) => {
    const { devices } = await getFeaturesStatus(
      queryClient,
      credentials.serverName,
    );
    if (!devices) throw notFound();
  },
  component: () => <Outlet />,
});
