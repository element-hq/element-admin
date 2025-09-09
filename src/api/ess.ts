import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import * as v from "valibot";

const VersionResponse = v.object({
  version: v.fallback(v.nullable(v.string()), null),
  edition: v.fallback(v.nullable(v.picklist(["community", "pro"])), null),
});

export const essVersionQuery = (synapseRoot: string) =>
  queryOptions({
    queryKey: ["ess", "version", synapseRoot],
    queryFn: async ({ signal }) => {
      const versionUrl = new URL("/_synapse/ess/version", synapseRoot);
      const response = await fetch(versionUrl, {
        signal,
      });

      if (response.status >= 400 && response.status < 500) {
        console.warn(
          "Failed to detect ESS version, this is probably not an ESS deployment",
        );
        return { version: null, edition: null };
      }

      const versionData = v.parse(VersionResponse, await response.json());

      return versionData;
    },
  });

export const useEssVariant = (
  synapseRoot: string,
): null | "community" | "pro" => {
  const { data } = useSuspenseQuery(essVersionQuery(synapseRoot));
  return data.edition;
};

export const useEssVersion = (synapseRoot: string): null | string => {
  const { data } = useSuspenseQuery(essVersionQuery(synapseRoot));
  return data?.version;
};
