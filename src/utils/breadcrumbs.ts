import { useMatches } from "@tanstack/react-router";
import type { IntlShape, MessageDescriptor } from "react-intl";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    breadcrumb?: BreadcrumbEntry;
  }
}

export interface WithBreadcrumbEntry extends Record<string, unknown> {
  breadcrumb: BreadcrumbEntry;
}

type BreadcrumbEntry =
  | {
      // A breadcrumb entry which renders the given string literal
      literal: string;
    }
  | {
      // A breadcrumb entry which renders a localizable message
      message: MessageDescriptor;
    };

const hasBreadcrumbEntry = (data: unknown): data is WithBreadcrumbEntry =>
  typeof data === "object" &&
  data !== null &&
  "breadcrumb" in data &&
  typeof data.breadcrumb === "object" &&
  data.breadcrumb !== null;

export const useBreadcrumbsFromMatches = (): BreadcrumbEntry[] => {
  // Two ways to inject breadcrumbs from routes:
  //  - in the route staticData, if it's a static breadcrumb segment
  //  - in the route loader, if it depends on dynamic context
  const matches = useMatches();
  return matches.flatMap((match) => {
    const breadcrumbs: BreadcrumbEntry[] = [];
    if (match.staticData.breadcrumb)
      breadcrumbs.push(match.staticData.breadcrumb);
    if (hasBreadcrumbEntry(match.loaderData))
      breadcrumbs.push(match.loaderData.breadcrumb);
    return breadcrumbs;
  });
};

export const formatBreadcrumbs = (
  intl: IntlShape,
  breadcrumbs: BreadcrumbEntry[],
): string =>
  breadcrumbs
    .toReversed()
    .map((breadcrumb) => {
      if ("message" in breadcrumb) {
        return intl.formatMessage(breadcrumb.message);
      }

      return breadcrumb.literal;
    })
    .join(" • ");
