export interface WithBreadcrumbEntry {
  breadcrumb: BreadcrumbEntry;
}

interface BreadcrumbEntry {
  name: string;
}

export const formatBreadcrumbs = (breadcrumbs: BreadcrumbEntry[]): string =>
  breadcrumbs
    .toReversed()
    .map((breadcrumb) => breadcrumb.name)
    .join(" • ");
