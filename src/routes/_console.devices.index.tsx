// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { createFileRoute, redirect } from "@tanstack/react-router";

import { defaultUserDevicesSearch } from "@/ui/device-tabs";

export const Route = createFileRoute("/_console/devices/")({
  beforeLoad: () => {
    throw redirect({ to: "/devices/user", search: defaultUserDevicesSearch });
  },
});
