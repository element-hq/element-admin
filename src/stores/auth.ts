// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { QueryClient } from "@tanstack/react-query";
import { shared } from "use-broadcast-ts";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { authMetadataQuery, tokenRequest } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { NotLoggedInError } from "@/errors";
import { reset } from "@/query";
import { router } from "@/router";
import { randomString } from "@/utils/random";
import { addTimeout } from "@/utils/signal";

const REFRESH_LOCK = "element-admin-refresh-lock";

// Normalize the server name. For now it only lowercases and trim
function normalizeServerName(serverName: string): string {
  return serverName.toLocaleLowerCase().trim();
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return globalThis.crypto.subtle.digest("SHA-256", data);
}

function base64urlencode(buffer: ArrayBuffer) {
  let string_ = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    string_ += String.fromCodePoint(byte);
  }
  return btoa(string_)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(codeVerifier: string) {
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64urlencode(hashed);
  return codeChallenge;
}

async function generatePkcePair() {
  const codeVerifier = randomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
  };
}

interface AuthorizationSession {
  serverName: string;
  clientId: string;
  codeChallenge: string;
  codeVerifier: string;
  state: string;
  redirect: string | undefined;
}

interface DynamicCredential {
  serverName: string;
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  static: false;
}

interface StaticCredential {
  serverName: string;
  accessToken: string;
  static: true;
}

interface AuthStoreState {
  /** The current authorization session, if any */
  authorizationSession: AuthorizationSession | null;

  /** The active credentials, if any */
  credentials: DynamicCredential | StaticCredential | null;
}

interface AuthStoreActions {
  startAuthorizationSession: (
    serverName: string,
    clientId: string,
    redirect: string | undefined,
  ) => Promise<{
    state: string;
    codeChallenge: string;
  }>;

  useStaticCredential(serverName: string, accessToken: string): Promise<void>;

  saveCredentials(
    serverName: string,
    clientId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): Promise<void>;

  /**
   * Returns the access token for the current session, or null if the
   * session is not active.
   *
   * @param queryClient The TanStack Query Client, used to get access to cached server metadata
   * @param signal Optional AbortSignal to abort the request
   * @returns A (hopefully valid) access token, or null if no credentials are available
   */
  accessToken(
    queryClient: QueryClient,
    abortSignal?: AbortSignal,
  ): Promise<string>;

  clear: () => Promise<void>;
}

const isExpired = (credentials: DynamicCredential): boolean => {
  if (credentials.static) return false;
  const leeway = 30 * 1000; // 30 seconds
  return credentials.expiresAt - leeway < Date.now();
};

type AuthStore = AuthStoreState & AuthStoreActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    shared(
      (set, get) => ({
        authorizationSession: null,
        credentials: null,

        async startAuthorizationSession(rawServerName, clientId, redirect) {
          const serverName = normalizeServerName(rawServerName);
          const current = get();
          if (
            current.authorizationSession?.serverName === serverName &&
            current.authorizationSession?.clientId === clientId
          ) {
            // Don't start a new session if we're already in one
            return {
              state: current.authorizationSession.state,
              codeChallenge: current.authorizationSession.codeChallenge,
            };
          }

          const state = randomString(32);
          const { codeVerifier, codeChallenge } = await generatePkcePair();

          await set({
            authorizationSession: {
              serverName,
              clientId,
              codeVerifier,
              codeChallenge,
              state,
              redirect,
            },
          });

          return {
            state,
            codeChallenge,
          };
        },

        async accessToken(queryClient, signal) {
          signal = addTimeout(signal, 10 * 1000);

          const current = get();

          // No credentials, no access token
          if (!current.credentials) {
            throw new NotLoggedInError();
          }

          // No need to refresh a static credential
          if (current.credentials.static) {
            return current.credentials.accessToken;
          }

          // Looks like it's not expired, return early with the access token
          if (!isExpired(current.credentials)) {
            return current.credentials.accessToken;
          }

          signal.throwIfAborted();

          const wellKnown = await queryClient.ensureQueryData(
            wellKnownQuery(current.credentials.serverName),
          );

          signal.throwIfAborted();

          const { token_endpoint } = await queryClient.ensureQueryData(
            authMetadataQuery(wellKnown["m.homeserver"].base_url),
          );

          signal.throwIfAborted();

          return await navigator.locks.request(
            REFRESH_LOCK,
            { signal },
            async (): Promise<string> => {
              const current = get();

              // Looks like we've got logged out in the meantime
              if (!current.credentials) {
                throw new NotLoggedInError();
              }

              // No need to refresh a static credential
              if (current.credentials.static) {
                return current.credentials.accessToken;
              }

              // Maybe we got refreshed in parallel in the meantime? Let's check again
              if (!isExpired(current.credentials)) {
                return current.credentials.accessToken;
              }

              // Alright, real business: refresh the token
              const response = await tokenRequest(
                token_endpoint,
                {
                  grant_type: "refresh_token",
                  refresh_token: current.credentials.refreshToken,
                  client_id: current.credentials.clientId,
                },
                signal,
              );

              await current.saveCredentials(
                current.credentials.serverName,
                current.credentials.clientId,
                response.access_token,
                response.refresh_token,
                response.expires_in,
              );

              return response.access_token;
            },
          );
        },

        async useStaticCredential(rawServerName, accessToken) {
          const serverName = normalizeServerName(rawServerName);
          const credentials = {
            serverName,
            accessToken,
            static: true,
          } satisfies StaticCredential;
          await set({ authorizationSession: null, credentials });
        },

        async saveCredentials(
          rawServerName,
          clientId,
          accessToken,
          refreshToken,
          expiresIn,
        ) {
          const serverName = normalizeServerName(rawServerName);
          const expiresAt = Date.now() + expiresIn * 1000;
          const credentials = {
            serverName,
            clientId,
            accessToken,
            refreshToken,
            expiresAt,
            static: false,
          } satisfies DynamicCredential;
          await set({ authorizationSession: null, credentials });
        },

        async clear() {
          await set({ authorizationSession: null, credentials: null });

          // Reset the query client
          await reset();
        },
      }),
      { name: "auth" },
    ),
    { name: "auth" },
  ),
);

export const accessToken = (queryClient: QueryClient, signal?: AbortSignal) =>
  useAuthStore.getState().accessToken(queryClient, signal);

useAuthStore.subscribe((oldState, newState) => {
  if (!!oldState.credentials !== !!newState.credentials) {
    router.invalidate();
  }
});

// Expose a method to expose the static credential
(globalThis as Record<string, unknown>)["__useStaticCredentials"] = (
  serverName: string,
  accessToken: string,
) => {
  useAuthStore.getState().useStaticCredential(serverName, accessToken);
};

(globalThis as Record<string, unknown>)["__clearCredentials"] = () => {
  useAuthStore.getState().clear();
};
