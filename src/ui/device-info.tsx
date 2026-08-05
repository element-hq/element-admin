// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  ComputerIcon,
  MobileIcon,
  UnknownIcon,
  WebBrowserIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Text } from "@vector-im/compound-web";
import { useMemo } from "react";
import { useIntl } from "react-intl";

import {
  type DeviceType,
  type ParsedUserAgent,
  parseUserAgent,
} from "@/utils/user-agent";

export const useParsedUserAgent = (
  userAgent: string | null | undefined,
): ParsedUserAgent | undefined =>
  useMemo(
    () => (userAgent ? parseUserAgent(userAgent) : undefined),
    [userAgent],
  );

// Human-friendly name of a device, mirroring what MAS shows in its account
// management UI: the user-given name first, then the device model, then
// "App on OS" derived from the user-agent, then the given fallback (e.g. the
// application name or the device ID)
export const useDeviceName = ({
  humanName,
  userAgent,
  fallback,
}: {
  humanName?: string | null;
  userAgent?: ParsedUserAgent | undefined;
  fallback?: string | null;
}): string => {
  const intl = useIntl();

  if (humanName) return humanName;
  if (userAgent?.model) return userAgent.model;
  if (userAgent?.name) {
    if (userAgent.os) {
      return intl.formatMessage(
        {
          id: "ui.device_info.name_on_platform",
          defaultMessage: "{name} on {platform}",
          description:
            "Name of a device derived from its user-agent, e.g. 'Firefox on macOS'",
        },
        { name: userAgent.name, platform: userAgent.os },
      );
    }
    return userAgent.name;
  }
  if (fallback) return fallback;

  return intl.formatMessage({
    id: "ui.device_info.unknown_device",
    defaultMessage: "Unknown device",
    description: "Shown when we can't figure out the name of a device",
  });
};

const DeviceTypeIcon: React.FC<{
  deviceType: DeviceType | undefined;
  className?: string;
}> = ({ deviceType, className }) => {
  const intl = useIntl();

  switch (deviceType) {
    case "pc": {
      return (
        <ComputerIcon
          className={className}
          aria-label={intl.formatMessage({
            id: "ui.device_info.type.pc",
            defaultMessage: "Computer",
            description: "Device type icon label for computers",
          })}
        />
      );
    }
    case "mobile": {
      return (
        <MobileIcon
          className={className}
          aria-label={intl.formatMessage({
            id: "ui.device_info.type.mobile",
            defaultMessage: "Mobile device",
            description: "Device type icon label for mobile devices",
          })}
        />
      );
    }
    case "tablet": {
      return (
        <WebBrowserIcon
          className={className}
          aria-label={intl.formatMessage({
            id: "ui.device_info.type.tablet",
            defaultMessage: "Tablet",
            description: "Device type icon label for tablets",
          })}
        />
      );
    }
    default: {
      return (
        <UnknownIcon
          className={className}
          aria-label={intl.formatMessage({
            id: "ui.device_info.type.unknown",
            defaultMessage: "Unknown device type",
            description: "Device type icon label for unknown device types",
          })}
        />
      );
    }
  }
};

// Large device-type icon in a circle, for detail pane headers
export const DeviceTypeHero: React.FC<{
  deviceType: DeviceType | undefined;
}> = ({ deviceType }) => (
  <div className="flex items-center justify-center size-16 rounded-full bg-bg-subtle-secondary">
    <DeviceTypeIcon
      deviceType={deviceType}
      className="size-8 text-icon-secondary"
    />
  </div>
);

interface DeviceInfoProps {
  humanName?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  fallbackName?: string | null;
}

// Compact "device type icon + name + device ID" block for an OAuth 2.0 or
// compatibility session, suitable for table rows. The device-type icon is
// shown inside a circular avatar-style badge, matching a 32px user avatar.
export const DeviceInfo: React.FC<DeviceInfoProps> = ({
  humanName,
  userAgent,
  deviceId,
  fallbackName,
}: DeviceInfoProps) => {
  const parsed = useParsedUserAgent(userAgent);
  const name = useDeviceName({
    humanName,
    userAgent: parsed,
    fallback: fallbackName,
  });

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex items-center justify-center size-8 rounded-full bg-bg-subtle-secondary shrink-0">
        <DeviceTypeIcon
          deviceType={parsed?.deviceType}
          className="size-5 text-icon-secondary"
        />
      </div>
      <div className="flex flex-col min-w-0">
        <Text
          size="md"
          weight="semibold"
          className="text-text-primary truncate"
        >
          {name}
        </Text>
        {deviceId && (
          <Text size="sm" className="text-text-secondary truncate font-mono">
            {deviceId}
          </Text>
        )}
      </div>
    </div>
  );
};
