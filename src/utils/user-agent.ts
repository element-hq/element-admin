// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import woothee from "woothee";

// This is a TypeScript port of the user-agent parsing MAS does server-side
// (crates/data-model/src/user_agent.rs), using the same `woothee` library, as
// the MAS admin API only exposes the raw user-agent string.

const VALUE_UNKNOWN = "UNKNOWN";

// Matches custom user-agents from Matrix clients, like:
//   ElementX/1.4.1 (iPhone 14; iOS 17.0.3; Scale/3.00)
const CUSTOM_USER_AGENT_REGEX =
  /^(?<name>[^/]+)\/(?<version>[^ ]+) \((?<segments>.+)\)$/;

const ELECTRON_USER_AGENT_REGEX = /\w+\/[\w.]+/g;

export type DeviceType = "pc" | "mobile" | "tablet" | "unknown";

export interface ParsedUserAgent {
  name?: string;
  version?: string;
  os?: string;
  osVersion?: string;
  model?: string;
  deviceType: DeviceType;
  raw: string;
}

interface CustomParseResult {
  name: string;
  version: string;
  model: string;
  os: string;
  osVersion?: string;
}

const parseCustom = (userAgent: string): CustomParseResult | null => {
  const groups = CUSTOM_USER_AGENT_REGEX.exec(userAgent)?.groups;
  if (!groups || !groups["name"] || !groups["version"] || !groups["segments"])
    return null;

  const segments = groups["segments"].split(";").map((s) => s.trim());

  let model: string;
  let os: string;
  if (
    segments.length >= 4 &&
    segments[0] === "Linux" &&
    segments[1] === "U" &&
    segments[2] !== undefined &&
    segments[3] !== undefined
  ) {
    os = segments[2];
    model = segments[3];
  } else if (
    segments.length >= 2 &&
    segments[0] !== undefined &&
    segments[1] !== undefined
  ) {
    model = segments[0];
    os = segments[1];
  } else {
    return null;
  }

  // Most Android models have a `/[build version]` suffix we don't care about
  const slash = model.indexOf("/");
  if (slash !== -1) model = model.slice(0, slash);
  // Some Android models also have a `Build` suffix we don't care about
  if (model.endsWith("Build")) model = model.slice(0, -"Build".length);
  // And let's trim any leftovers
  model = model.trim();

  let osVersion: string | undefined;
  const space = os.indexOf(" ");
  if (space !== -1) {
    osVersion = os.slice(space + 1);
    os = os.slice(0, space);
  }

  return {
    name: groups["name"],
    version: groups["version"],
    model,
    os,
    osVersion,
  };
};

// Electron-based applications (e.g. Element Desktop) embed the application
// name and version in the user-agent; pick the first `Name/version` pair that
// isn't part of the standard browser engine boilerplate
const parseElectron = (
  userAgent: string,
): { name: string; version: string } | null => {
  const omitKeys = new Set([
    "Mozilla",
    "AppleWebKit",
    "Chrome",
    "Electron",
    "Safari",
  ]);
  for (const match of userAgent.matchAll(ELECTRON_USER_AGENT_REGEX)) {
    const [name = "", version = ""] = match[0].split("/", 2);
    if (!omitKeys.has(name)) return { name, version };
  }
  return null;
};

// Join a name with its optional version for display, e.g. "Firefox 142"
const withVersion = (name: string, version: string | undefined): string =>
  version ? `${name} ${version}` : name;

// One-line app and OS summary of a parsed user-agent, e.g.
// "Firefox 151.0 · Linux", for detail pane subtitles
export const userAgentSummary = (
  userAgent: ParsedUserAgent | undefined,
): string | undefined => {
  if (!userAgent) return undefined;
  const parts: string[] = [];
  if (userAgent.name)
    parts.push(withVersion(userAgent.name, userAgent.version));
  if (userAgent.os) parts.push(withVersion(userAgent.os, userAgent.osVersion));
  return parts.length > 0 ? parts.join(" · ") : undefined;
};

export const parseUserAgent = (userAgent: string): ParsedUserAgent => {
  if (!userAgent.includes("Mozilla/")) {
    const custom = parseCustom(userAgent);
    if (custom) {
      let deviceType: DeviceType = "unknown";

      // Handle simple mobile devices
      if (custom.os === "Android" || custom.os === "iOS") {
        deviceType = "mobile";
      }

      // Handle iPads
      if (custom.model.includes("iPad")) {
        deviceType = "tablet";
      }

      return {
        name: custom.name,
        version: custom.version,
        os: custom.os,
        ...(custom.osVersion !== undefined && { osVersion: custom.osVersion }),
        model: custom.model,
        deviceType,
        raw: userAgent,
      };
    }
  }

  const result = woothee.parse(userAgent);
  let model: string | undefined;

  let deviceType: DeviceType;
  switch (result.category) {
    case "pc": {
      deviceType = "pc";
      break;
    }
    case "smartphone":
    case "mobilephone": {
      deviceType = "mobile";
      break;
    }
    default: {
      deviceType = "unknown";
    }
  }

  // Special handling for Chrome user-agent reduction cases
  // https://www.chromium.org/updates/ua-reduction/
  if (
    result.os === "Windows 10" &&
    result.os_version === "NT 10.0" &&
    userAgent.includes("Windows NT 10.0; Win64; x64")
  ) {
    result.os = "Windows";
    result.os_version = VALUE_UNKNOWN;
  } else if (result.os === "Linux" && userAgent.includes("X11; Linux x86_64")) {
    result.os = "Linux";
    result.os_version = VALUE_UNKNOWN;
  } else if (
    result.os === "ChromeOS" &&
    userAgent.includes("X11; CrOS x86_64 14541.0.0")
  ) {
    result.os = "Chrome OS";
    result.os_version = VALUE_UNKNOWN;
  } else if (
    result.os === "Android" &&
    result.os_version === "10" &&
    userAgent.includes("Linux; Android 10; K")
  ) {
    result.os = "Android";
    result.os_version = VALUE_UNKNOWN;
  } else if (
    result.os === "Mac OSX" &&
    result.os_version === "10.15.7" &&
    userAgent.includes("Macintosh; Intel Mac OS X 10_15_7")
  ) {
    result.os = "macOS";
    result.os_version = VALUE_UNKNOWN;
  } else if (result.os === "iPhone" || result.os === "iPod") {
    // Woothee identifies iPhone and iPod in the OS, but we want to map them
    // to iOS and use them as model
    model = result.os;
    result.os = "iOS";
  } else if (result.os === "iPad") {
    model = result.os;
    deviceType = "tablet";
    result.os = "iPadOS";
  } else if (result.os === "Mac OSX") {
    result.os = "macOS";
  }

  // For some reason, the version on Windows is on the OS field
  // This transforms `Windows 10` into `Windows` and `10`.
  // Not every Windows label woothee produces is `Windows <version>` though, so
  // the three that aren't have to be handled before the generic split.
  if (result.os === "Windows UNKNOWN Ver") {
    // Woothee's fallback label for a Windows release it doesn't know. It leaves
    // `os_version` either unset or set to the raw NT version (e.g. `NT 11.0`),
    // both of which beat slicing "UNKNOWN Ver" out of the name.
    result.os = "Windows";
  } else if (result.os === "Windows Phone OS") {
    // `os_version` already holds the real version here, so only the name needs
    // normalising — splitting would overwrite it with "Phone OS".
    result.os = "Windows Phone";
  } else if (result.os !== "Windows CE" && result.os.startsWith("Windows ")) {
    // "Windows CE" is an OS name in its own right, not a version of Windows.
    result.os_version = result.os.slice("Windows ".length);
    result.os = "Windows";
  }

  // Special handling for Electron applications e.g. Element Desktop
  if (userAgent.includes("Electron/")) {
    const app = parseElectron(userAgent);
    if (app) {
      result.name = app.name;
      result.version = app.version;
    }
  }

  return {
    ...(result.name !== VALUE_UNKNOWN && { name: result.name }),
    ...(result.version !== VALUE_UNKNOWN && { version: result.version }),
    ...(result.os !== VALUE_UNKNOWN && { os: result.os }),
    ...(result.os_version !== VALUE_UNKNOWN &&
      result.os_version !== undefined && { osVersion: result.os_version }),
    ...(model !== undefined && { model }),
    deviceType,
    raw: userAgent,
  };
};
