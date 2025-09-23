// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { WelcomeLayout } from "@/components/layout";

import { Loading } from "./loading";

/**
 * This is what is displayed when the app is loading.
 * Because of when this is displayed, there are a few constraints with this:
 *
 *   - no localized text
 *   - no compound (-web or -design-tokens)
 *   - no suspending or throwing errors
 *
 * This gets pre-rendered at build-time
 */
const LoadingFallback: React.FC = () => (
  <WelcomeLayout className="items-center justify-center">
    <Loading />
  </WelcomeLayout>
);

export default LoadingFallback;
