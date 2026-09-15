// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import type { ReactNode } from "react";

import * as Placeholder from "@/components/placeholder";

const cardClasses =
  "self-stretch flex items-center gap-3 p-3 rounded-lg border border-separator-primary";

// A clickable card linking to another resource in the console, with a
// chevron hinting at the navigation. Suitable for cross-linking related
// entities from a detail pane.
export const EntityCard = ({
  children,
  ...props
}: LinkProps & { children: ReactNode }) => (
  <Link
    {...props}
    className={`${cardClasses} transition hover:bg-bg-subtle-secondary`}
  >
    <div className="flex-1 min-w-0">{children}</div>
    <ChevronRightIcon
      aria-hidden="true"
      className="shrink-0 text-icon-tertiary"
    />
  </Link>
);

// A non-interactive card with the same shape as an entity card, for showing an
// entity for context (e.g. in a confirmation dialog) without linking anywhere.
export const StaticEntityCard = ({ children }: { children: ReactNode }) => (
  <div className={cardClasses}>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

// A loading placeholder with the same shape as an entity card
export const EntityCardSkeleton = () => (
  <div className={cardClasses}>
    <Placeholder.Loading />
    <Placeholder.Avatar />
    <div className="flex flex-col gap-1 flex-1 max-w-60">
      <Placeholder.Text />
    </div>
  </div>
);
