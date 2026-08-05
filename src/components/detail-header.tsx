// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { H3, Text } from "@vector-im/compound-web";
import type { ReactNode } from "react";

interface DetailHeaderProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
}

// Centered header for detail panes: an icon or avatar, a title, an optional
// subtitle and optional badges
export const DetailHeader: React.FC<DetailHeaderProps> = ({
  icon,
  title,
  subtitle,
  badges,
}: DetailHeaderProps) => (
  <div className="flex flex-col items-center gap-2 text-center">
    {icon}
    <div className="flex flex-col items-center min-w-0 max-w-full">
      <H3 className="break-words max-w-full">{title}</H3>
      {subtitle && (
        <Text size="md" className="text-text-secondary break-words max-w-full">
          {subtitle}
        </Text>
      )}
    </div>
    {badges && <div className="flex items-center gap-2">{badges}</div>}
  </div>
);
