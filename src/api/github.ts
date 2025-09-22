import { queryOptions } from "@tanstack/react-query";
import parseSemver from "semver/functions/parse";
import * as v from "valibot";

import { ensureResponseOk, fetch } from "@/utils/fetch";

const ReleaseResponse = v.object({
  html_url: v.string(),
  name: v.string(),
  // XXX: this parses the version from the tag as semver; maybe we want to do
  // that in a separate field?
  tag_name: v.pipe(
    v.string(),
    v.transform((version) => parseSemver(version, true, false)),
  ),
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
