// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { queryOptions } from "@tanstack/react-query";
import { compare, parse, tryParse, type SemVer } from "verkit";

import { ensureResponseOk, fetch } from "@/utils/fetch";

const ESS_PRO_FEED_URL =
  "https://docs.element.io/latest/element-server-suite-pro/release-notes/feed.xml";

// The feed has no structured version field, so the title is the only source:
// "ESS Pro 26.10.6 (2026-11-11)" or "ESS Pro LTS 26.4.11 (2026-10-29)".
const TITLE_PATTERN = /^ESS Pro (LTS )?(\d+\.\d+\.\d+)(?=\s|$)/;

export interface EssProRelease {
  version: string;
  lts: boolean;
  link: string;
}

const parseItem = (item: Element): EssProRelease | null => {
  const title = item.querySelector("title")?.textContent?.trim() ?? "";
  const link = item.querySelector("link")?.textContent?.trim() ?? "";

  const match = TITLE_PATTERN.exec(title);
  const version = match?.[2];
  if (!match || !version || !tryParse(version)) return null;

  // The link is rendered as an href, so only http(s) URLs are accepted.
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  return { version, lts: match[1] !== undefined, link: url.toString() };
};

const parseEssProFeed = (xml: string): EssProRelease[] => {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("The ESS Pro release feed is not valid XML");
  }

  const releases = [...document.querySelectorAll("channel > item")]
    .map((item) => parseItem(item))
    .filter((release) => release !== null);

  if (releases.length === 0) {
    throw new Error("The ESS Pro release feed has no recognisable release");
  }

  return releases;
};

export const essProReleasesQuery = queryOptions({
  queryKey: ["ess-pro", "releases"],
  queryFn: async ({ signal }) => {
    const response = await fetch(ESS_PRO_FEED_URL, { signal });
    ensureResponseOk(response);
    return parseEssProFeed(await response.text());
  },
});

/** The `major.minor` release stream a release belongs to, like `26.10`. */
export const streamOf = (release: EssProRelease): string => {
  const { major, minor } = parse(release.version);
  return `${major}.${minor}`;
};

export interface EssProUpdate {
  stream: "lts" | "mainline";
  /**
   * The newest release of the deployment's stream. `null` for an LTS stream
   * the feed no longer lists.
   */
  latest: EssProRelease | null;
  isRunningLatest: boolean;
  /**
   * The newest release of the newest LTS stream after the deployment's own.
   * Always `null` for a mainline deployment.
   */
  newerLts: EssProRelease | null;
}

interface ParsedRelease {
  release: EssProRelease;
  version: SemVer;
}

const newest = (candidates: ParsedRelease[]): ParsedRelease | undefined => {
  let result: ParsedRelease | undefined;
  for (const candidate of candidates) {
    if (!result || compare(candidate.version, result.version) > 0) {
      result = candidate;
    }
  }
  return result;
};

const sameLine = (a: SemVer, b: SemVer): boolean =>
  a.major === b.major && a.minor === b.minor;

const isLaterLine = (a: SemVer, b: SemVer): boolean =>
  a.major > b.major || (a.major === b.major && a.minor > b.minor);

/**
 * Works out which releases a Pro deployment running `current` should be told
 * about.
 *
 * An LTS stream is a `major.minor` line. Its releases carry `+lts` build
 * metadata in the version the deployment reports; the feed drops that and
 * marks them in the title. A line also holds releases which are not LTS: the
 * ones published before the line became one.
 *
 * An LTS deployment is compared to the newest release of its own line, and is
 * told about the newest later line with LTS releases. Any other deployment is
 * compared to the newest release which is either non-LTS or on its own line.
 * Returns `null` if the feed has nothing to compare to.
 */
export const checkEssProUpdate = (
  releases: readonly EssProRelease[],
  current: SemVer,
): EssProUpdate | null => {
  const parsed = releases.map((release) => ({
    release,
    version: parse(release.version),
  }));
  const onCurrentLine = parsed.filter(({ version }) =>
    sameLine(version, current),
  );
  const isRunning = (target: ParsedRelease): boolean =>
    compare(current, target.version) >= 0;

  if (current.build?.includes("lts")) {
    const latest = newest(onCurrentLine);
    const newerLts = newest(
      parsed.filter(
        ({ release, version }) => release.lts && isLaterLine(version, current),
      ),
    );
    if (latest || newerLts) {
      return {
        stream: "lts",
        latest: latest?.release ?? null,
        isRunningLatest: !!latest && isRunning(latest),
        newerLts: newerLts?.release ?? null,
      };
    }
  }

  const latest = newest([
    ...parsed.filter(({ release }) => !release.lts),
    ...onCurrentLine,
  ]);
  if (!latest) return null;

  return {
    stream: "mainline",
    latest: latest.release,
    isRunningLatest: isRunning(latest),
    newerLts: null,
  };
};
