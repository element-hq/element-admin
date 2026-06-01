// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { ChevronDownIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Text } from "@vector-im/compound-web";
import type { ReactNode } from "react";

interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
}

// A collapsed-by-default section, for secondary content which shouldn't
// clutter the main flow but should stay one click away
export const Disclosure: React.FC<DisclosureProps> = ({
  summary,
  children,
}: DisclosureProps) => (
  <details className="group">
    <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <Text as="span" size="md" weight="semibold" className="text-text-primary">
        {summary}
      </Text>
      <ChevronDownIcon
        aria-hidden="true"
        className="shrink-0 text-icon-secondary transition-transform group-open:rotate-180"
      />
    </summary>
    <div className="pt-3">{children}</div>
  </details>
);
