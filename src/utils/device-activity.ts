// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

// How recently a device must have been seen to count as "recently used"
// (roughly a fortnight), and the age past which it is considered "inactive".
const RECENTLY_USED_WITHIN_DAYS = 14;
const INACTIVE_AFTER_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ActivityCutoffs {
  // A device last active at or after this instant is "recently used".
  readonly recentlyUsed: string;
  // A device last active before this instant is "inactive".
  readonly inactive: string;
}

// ISO timestamp `days` days before `now`, floored to the start of the UTC day.
// Flooring keeps the value stable within a day, so it doesn't churn React Query
// keys or memoised values on every navigation.
const cutoffIso = (now: number, days: number): string => {
  const date = new Date(now - days * DAY_MS);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
};

export const activityCutoffs = (now: number): ActivityCutoffs => ({
  recentlyUsed: cutoffIso(now, RECENTLY_USED_WITHIN_DAYS),
  inactive: cutoffIso(now, INACTIVE_AFTER_DAYS),
});

// ISO timestamp `days` days before `now`, floored to the start of the UTC day,
// for callers that need a cutoff outside the activity buckets (e.g. the "added
// in the past week" statistics). Day-floored for the same key-stability reason.
export const daysAgoIso = (now: number, days: number): string =>
  cutoffIso(now, days);

// The state shown by a device's status badge. Note this is deliberately *not*
// the same set as the activity filter buckets below: the API filters on
// `last-active-before` / `last-active-after`, neither of which can match a
// session whose `last_active_at` is still null, so "never-used" is a badge
// state with no corresponding bucket.
export type DeviceActivityStatus =
  | "signed-out"
  | "never-used"
  | "recently-used"
  | "active"
  | "inactive";

// Classify a session from its finished/last-active timestamps. `cutoffs` is
// passed in (rather than read from the clock here) so the impure "now" lookup
// stays at the call site, where react-compiler wants it lazily initialised.
export const deviceActivityStatus = (
  {
    finishedAt,
    lastActiveAt,
  }: { finishedAt?: string | null; lastActiveAt?: string | null },
  cutoffs: ActivityCutoffs,
): DeviceActivityStatus => {
  if (finishedAt) return "signed-out";
  // MAS leaves `last_active_at` null until the session is first used. Don't
  // claim an age we don't know: an unparseable timestamp is treated the same.
  if (!lastActiveAt) return "never-used";
  const lastActive = Date.parse(lastActiveAt);
  if (Number.isNaN(lastActive)) return "never-used";
  if (lastActive < Date.parse(cutoffs.inactive)) return "inactive";
  if (lastActive >= Date.parse(cutoffs.recentlyUsed)) return "recently-used";
  return "active";
};

// The activity buckets a device list can be filtered by. Fewer than the badge
// states above: "never-used" is not expressible as an API filter.
export type ActivityBucket =
  | "recently-used"
  | "active"
  | "inactive"
  | "signed-out";

// The subset of the OAuth 2.0 / compatibility session list parameters that an
// activity bucket maps onto. Both list endpoints accept exactly these, with
// identical types, so one mapping serves both tabs.
export interface ActivityFilterParameters {
  status?: "active" | "finished";
  lastActiveAfter?: string;
  lastActiveBefore?: string;
}

// Translate the selected activity bucket into the API's status / last-active
// filters. Cutoffs are floored to the day, so the resulting parameters (and
// hence the query key) stay stable within a day. With no bucket selected we
// default to hiding signed-out devices, so the list shows the sessions a user
// currently has; the "Signed out" bucket opts back into seeing finished ones.
export const activityFilterParameters = (
  activity: ActivityBucket | undefined,
): ActivityFilterParameters => {
  if (!activity) return { status: "active" };
  const cutoffs = activityCutoffs(Date.now());
  switch (activity) {
    case "signed-out": {
      return { status: "finished" };
    }
    case "recently-used": {
      return { status: "active", lastActiveAfter: cutoffs.recentlyUsed };
    }
    case "inactive": {
      return { status: "active", lastActiveBefore: cutoffs.inactive };
    }
    // "active": the residual bucket between "recently used" and "inactive".
    default: {
      return {
        status: "active",
        lastActiveAfter: cutoffs.inactive,
        lastActiveBefore: cutoffs.recentlyUsed,
      };
    }
  }
};
