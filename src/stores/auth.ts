import type { QueryClient } from "@tanstack/react-query";
import { shared } from "use-broadcast-ts";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { authMetadataQuery, tokenRequest } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { router } from "@/router";

const REFRESH_LOCK = "element-admin-refresh-lock";

function randomString(length: number): string {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = new Uint8Array(length);
  window.crypto.getRandomValues(randomValues);

  let codeVerifier = "";
  for (const val of randomValues) {
    codeVerifier += possible[val % possible.length];
  }
  return codeVerifier;
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest("SHA-256", data);
}

function base64urlencode(buffer: ArrayBuffer) {
  let str = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

type AuthorizationSession = {
  serverName: string;
  clientId: string;
  codeChallenge: string;
  codeVerifier: string;
  state: string;
};

type Credentials = {
  serverName: string;
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

type AuthStoreState = {
  /** The current authorization session, if any */
  authorizationSession: AuthorizationSession | null;

  /** The active credentials, if any */
  credentials: Credentials | null;
};

type AuthStoreActions = {
  startAuthorizationSession: (
    serverName: string,
    clientId: string,
  ) => Promise<void>;

  saveCredentials(
    serverName: string,
    clientId: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): void;

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
  ): Promise<string | null>;

  clear: () => void;
};

const isExpired = (credentials: Credentials): boolean => {
  const leeway = 30 * 1000; // 30 seconds
  return credentials.expiresAt < Date.now() - leeway;
};

type AuthStore = AuthStoreState & AuthStoreActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    shared(
      (set, get) => ({
        authorizationSession: null,
        credentials: null,

        async startAuthorizationSession(serverName, clientId) {
          const current = get();
          if (
            current.authorizationSession?.serverName === serverName &&
            current.authorizationSession?.clientId === clientId
          ) {
            // Don't start a new session if we're already in one
            return;
          }

          const state = randomString(32);
          const { codeVerifier, codeChallenge } = await generatePkcePair();

          set({
            authorizationSession: {
              serverName,
              clientId,
              codeVerifier,
              codeChallenge,
              state,
            },
          });
        },

        async accessToken(queryClient, signal) {
          const current = get();

          // No credentials, no access token
          if (!current.credentials) {
            return null;
          }

          // Looks like it's not expired, return early with the access token
          if (!isExpired(current.credentials)) {
            return current.credentials.accessToken;
          }

          signal?.throwIfAborted();

          const wellKnown = await queryClient.ensureQueryData(
            wellKnownQuery(current.credentials.serverName),
          );

          signal?.throwIfAborted();

          const { token_endpoint } = await queryClient.ensureQueryData(
            authMetadataQuery(wellKnown["m.homeserver"].base_url),
          );

          signal?.throwIfAborted();

          return await navigator.locks.request(
            REFRESH_LOCK,
            signal ? { signal } : {},
            async (): Promise<string | null> => {
              const current = get();

              // Looks like we've got logged out in the meantime
              if (!current.credentials) {
                return null;
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

              current.saveCredentials(
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

        saveCredentials(
          serverName,
          clientId,
          accessToken,
          refreshToken,
          expiresIn,
        ) {
          const expiresAt = Date.now() + expiresIn * 1000;
          const credentials = {
            serverName,
            clientId,
            accessToken,
            refreshToken,
            expiresAt,
          };
          set({ authorizationSession: null, credentials });
        },

        clear() {
          set({ authorizationSession: null, credentials: null });
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
