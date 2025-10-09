// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  experimental_createQueryPersister,
  type AsyncStorage,
  type PersistedQuery,
} from "@tanstack/query-persist-client-core";
import { QueryClient } from "@tanstack/react-query";
import { get, set, del, clear } from "idb-keyval";

const storage: AsyncStorage<PersistedQuery> = {
  async getItem(key: string) {
    return await get(key);
  },
  async setItem(key: string, value: PersistedQuery) {
    // For some reason, awaiting here makes thing hang
    set(key, value);
  },
  async removeItem(key: string) {
    await del(key);
  },
};

const persister = experimental_createQueryPersister({
  storage,
  serialize: (value: PersistedQuery) => value,
  deserialize: (value: PersistedQuery) => value,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoids re-fetching too often. Tanstack Query will usually refetch
      // whenever a component gets mounted. This keeps the query marked as
      // 'fresh' for 1 minute, so that we don't re-fetch too often.
      staleTime: 1 * 60 * 1000,

      // Keeps the query in memory for 5 minutes. They are persisted in the
      // storage anyway
      gcTime: 5 * 60 * 1000,
      persister: persister.persisterFn,
    },
  },
});

// In certain situations, we don't want to clear the cache when logging out
(globalThis as Record<string, unknown>)["__demoMode"] = (demoMode = true) => {
  set("demoMode", demoMode);
  if (demoMode) {
    console.log("Demo mode is now on, storage won't be cleared across logouts");
  } else {
    console.log("Demo mode is now off, storage will be cleared across logouts");
  }
};

export const reset = async () => {
  queryClient.clear();
  const demoMode = await get("demoMode");

  if (demoMode) {
    console.warn(
      "App is in demo mode (call __demoMode(false) to revert that), storage is persisted across logouts!",
    );
  } else {
    await clear();
  }
};
