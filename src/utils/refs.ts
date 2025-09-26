// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

type StrictRef<T> = NonNullable<React.Ref<T>>;
type RefCleanup<T> = ReturnType<React.RefCallback<T>>;

function assignRef<T>(ref: StrictRef<T>, value: T | null): RefCleanup<T> {
  if (ref == null) return;

  if (typeof ref === "function") {
    return ref(value);
  }

  try {
    ref.current = value;
  } catch (error) {
    throw new Error(`Cannot assign value '${value}' to ref '${ref}'`, {
      cause: error,
    });
  }
}

/**
 * Merge multiple refs into a single callback
 */
export function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  const available = refs.filter((ref) => ref != null);
  const cleanupMap = new Map<StrictRef<T>, Exclude<RefCleanup<T>, void>>();

  return (node: T | null) => {
    for (const ref of available) {
      const cleanup = assignRef(ref, node);
      if (cleanup) {
        cleanupMap.set(ref, cleanup);
      }
    }

    return () => {
      for (const ref of available) {
        const cleanup = cleanupMap.get(ref);
        if (cleanup && typeof cleanup === "function") {
          cleanup();
        } else {
          assignRef(ref, null);
        }
      }

      cleanupMap.clear();
    };
  };
}
