// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { queryOptions } from "@tanstack/react-query";
import * as v from "valibot";

import { ensureResponseOk, fetch } from "@/utils/fetch";

const ReleaseResponse = v.object({
  html_url: v.string(),
  name: v.string(),
  tag_name: v.string(),
  created_at: v.pipe(v.string(), v.isoTimestamp()),
  body: v.string(),
});

export const githubReleaseQuery = (repo: string, release: string) =>
  queryOptions({
    queryKey: ["github", repo, "release", release],
    queryFn: async ({ signal }) => {
      const url = new URL(
        `https://api.github.com/repos/${repo}/releases/${release}`,
      );
      const response = await fetch(url, {
        signal,
      });

      ensureResponseOk(response);

      const releaseData = v.parse(ReleaseResponse, await response.json());

      return releaseData;
    },
    // We don't want to re-fetch once we have the data, else we'll get rate-limited by GitHub
    staleTime: Infinity,
  });
