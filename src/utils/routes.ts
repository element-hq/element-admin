// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useMatches } from "@tanstack/react-router";

import type { FileRoutesById } from "@/routeTree.gen";

// Infer the child routes of a given route, including the route itself
type ChildRoutes<RouteId extends keyof FileRoutesById> = keyof FileRoutesById &
  `${RouteId}${string}`;

// Infer the paths of the child routes of a given route, including the route itself
type ChildRoutesPath<RouteId extends keyof FileRoutesById> = string &
  FileRoutesById[ChildRoutes<RouteId>]["fullPath"];

/**
 * Returns the path of the top-most child currently being rendered
 *
 * This is useful to render links which modify search params but keep the same
 * child route
 *
 * Use only from within a route component as `useCurrentChildRoutePath(Route.id)`
 */
export function useCurrentChildRoutePath<RouteId extends keyof FileRoutesById>(
  routeId: RouteId,
): ChildRoutesPath<RouteId> {
  const path = useMatches({
    select: (matches): string => {
      const reversed = matches.toReversed();
      for (const match of reversed) {
        if (match.id.startsWith(routeId)) {
          return match.fullPath;
        }
      }

      // This could happen if useCurrentChildRoutePath is being called with a
      // RouteId which isn't the current route
      throw new Error(`No child route found for ${routeId}, this is a bug`);
    },
  });

  return path as ChildRoutesPath<RouteId>;
}
