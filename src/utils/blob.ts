// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useEffect } from "react";

// A very simple LRU cache for Blob -> URL generation
let generation = 0;
interface Cached {
  lastTouched: number;
  active: number;
  url: string;
}
const urlCache = new Map<Blob, Cached>();

// How many entries to keep in the cache
const MAX_ENTRIES = 1000;

// Garbage collect the cache
const gc = () => {
  const candidates: { blob: Blob; url: string; lastTouched: number }[] = [];
  if (urlCache.size > MAX_ENTRIES) {
    // First collect potential candidates for eviction
    for (const [blob, entry] of urlCache.entries()) {
      // Ignore entries which haven't been touched
      if (entry.active <= 0 && entry.lastTouched !== 0) {
        candidates.push({
          blob,
          url: entry.url,
          lastTouched: entry.lastTouched,
        });
      }
    }

    // Sort the candidates by lastTouched
    candidates.sort((a, b) => b.lastTouched - a.lastTouched);

    while (urlCache.size > MAX_ENTRIES) {
      const candidate = candidates.pop();
      if (!candidate) {
        return;
      }
      urlCache.delete(candidate.blob);

      // Do it on the revoking on the next tick, else Safari won't like creating
      // and revoking URLs on the same tick
      setTimeout(() => URL.revokeObjectURL(candidate.url), 0);
    }
  }
};

// Get or create an entry in the cache
const entry = (blob: Blob): Cached => {
  const existing = urlCache.get(blob);
  if (existing) {
    return existing;
  }

  const entry = {
    lastTouched: 0,
    active: 0,
    url: URL.createObjectURL(blob),
  };
  urlCache.set(blob, entry);
  return entry;
};

// Get the URL for a blob, without marking it as being in-use
const get = (blob: Blob): string => {
  const cached = entry(blob);
  return cached.url;
};

// Increase the usage count of an entry
const hold = (blob: Blob) => {
  const cached = entry(blob);
  cached.lastTouched = generation++;
  cached.active++;
  gc();
};

// Decrease the usage count of an entry
const release = (blob: Blob) => {
  const entry = urlCache.get(blob);
  if (entry) {
    entry.active--;
    gc();
  }
};

export const useImageBlob = (blob: Blob | undefined): string | undefined => {
  // Create a new URL for the blob
  const objectUrl = blob && get(blob);

  // Mark the blob as being used on mount, release it on unmount
  useEffect(() => {
    if (blob) hold(blob);

    return () => {
      if (blob) release(blob);
    };
  }, [blob]);

  return objectUrl;
};
