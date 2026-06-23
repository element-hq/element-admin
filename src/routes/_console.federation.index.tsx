// Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
// Please see LICENSE files in the repository root for full details.

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_console/federation/")({
  beforeLoad: () => {
    throw redirect({ to: "/federation/known-domains" });
  },
});
