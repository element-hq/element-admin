// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SignOutIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { MenuItem, Separator } from "@vector-im/compound-web";
import { useCallback, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useIntl } from "react-intl";

import { authMetadataQuery, revokeToken } from "@/api/auth";
import { essVersionQuery, useEssVariant } from "@/api/ess";
import {
  mediaThumbnailQuery,
  profileQuery,
  wellKnownQuery,
  whoamiQuery,
} from "@/api/matrix";
import { CopyToClipboard } from "@/components/copy";
import * as Header from "@/components/header";
import { Layout } from "@/components/layout";
import { ElementLogo } from "@/components/logo";
import * as Navigation from "@/components/navigation";
import * as messages from "@/messages";
import { useAuthStore } from "@/stores/auth";
import AppNavigation from "@/ui/navigation";
import { useImageBlob } from "@/utils/blob";
import type { WithBreadcrumbEntry } from "@/utils/breadcrumbs";
import { getFeaturesStatus, useFeaturesStatus } from "@/utils/features";

interface TokenViewProps {
  token: string;
}
const TokenView: React.FC<TokenViewProps> = ({ token }: TokenViewProps) => (
  <div className="flex items-center justify-between py-2 px-4 gap-1 text-text-secondary font-mono text-xs">
    {token.length > 20
      ? // eslint-disable-next-line formatjs/no-literal-string-in-jsx -- Not a translatable string
        `${token.slice(0, 5)}${"•".repeat(5)}${token.slice(Math.max(0, token.length - 7))}`
      : "•".repeat(5)}
    <CopyToClipboard value={token} />
  </div>
);

export const Route = createFileRoute("/_console")({
  beforeLoad: async ({ context, location }) => {
    const state = useAuthStore.getState();
    if (!state.credentials) {
      throw redirect({
        to: "/login",
        // We include the current URL in the login search parameters to go back
        // to that page once the user is logged in, *unless* it is the root URL
        search: location.href === "/" ? undefined : { redirect: location.href },
      });
    }

    const { credentials } = state;
    const wellKnown = await context.queryClient.query({
      ...wellKnownQuery(credentials.serverName),
      staleTime: "static",
    });

    return {
      credentials,
      synapseRoot: wellKnown["m.homeserver"].base_url,
    };
  },

  loader: async ({ context: { credentials, synapseRoot, queryClient } }) => {
    const masFeaturesPromise = getFeaturesStatus(
      queryClient,
      credentials.serverName,
    );
    const essVersionPromise = queryClient.query({
      ...essVersionQuery(synapseRoot),
      staleTime: "static",
    });
    const whoami = await queryClient.query({
      ...whoamiQuery(synapseRoot),
      staleTime: "static",
    });
    await queryClient.query({
      ...profileQuery(synapseRoot, whoami.user_id),
      staleTime: "static",
    });
    await Promise.all([essVersionPromise, masFeaturesPromise]);

    return {
      breadcrumb: {
        literal: credentials.serverName,
      },
    } satisfies WithBreadcrumbEntry;
  },

  component: RouteComponent,
});

function RouteComponent() {
  const { credentials, synapseRoot } = Route.useRouteContext();
  // Keep the well-known observed so it never gets garbage-collected
  useQuery(wellKnownQuery(credentials.serverName));
  const { data: whoami } = useSuspenseQuery(whoamiQuery(synapseRoot));

  const { data: profile } = useSuspenseQuery(
    profileQuery(synapseRoot, whoami.user_id),
  );

  const { data: avatar } = useQuery(
    mediaThumbnailQuery(synapseRoot, profile.avatar_url),
  );

  const avatarUrl = useImageBlob(avatar);

  const features = useFeaturesStatus(credentials.serverName);
  const variant = useEssVariant(synapseRoot);

  // An easter egg to trigger toasts and error boundaries
  const logoClicks = useRef(0);
  const [clickedTooMuch, setClickedTooMuch] = useState(false);
  const onLogoClick = useCallback(() => {
    logoClicks.current++;

    if (logoClicks.current > 20) {
      toast("Oh, well.");
      setClickedTooMuch(true);
    } else if (logoClicks.current > 15) {
      const promise = new Promise((_, reject) => setTimeout(reject, 2000));
      toast.promise(promise, {
        loading: "Finding reasons why you kept clicking…",
        error: "No sensible reason found.",
      });
    } else if (logoClicks.current > 10) {
      toast.error("But like, really, stop.");
    } else if (logoClicks.current > 5) {
      toast.success("Okay you can stop clicking now.");
    }
  }, []);

  if (clickedTooMuch) {
    throw new Error("User clicked too many times");
  }

  return (
    <Layout>
      <Header.Root>
        <Header.Left>
          <ElementLogo variant={variant ?? "community"} onClick={onLogoClick} />
          <Header.HomeserverName>
            {credentials.serverName}
          </Header.HomeserverName>
        </Header.Left>

        <Header.Right>
          <Header.UserMenu
            mxid={whoami.user_id}
            displayName={profile.displayname}
            avatarUrl={avatarUrl}
          >
            <Header.UserMenuProfile
              mxid={whoami.user_id}
              displayName={profile.displayname}
              avatarUrl={avatarUrl}
            />
            <Separator />
            <TokenView token={credentials.accessToken} />
            {!credentials.static && (
              <>
                <Separator />
                <SignOutMenuItem
                  synapseRoot={synapseRoot}
                  credentials={credentials}
                />
              </>
            )}
          </Header.UserMenu>
        </Header.Right>
      </Header.Root>

      <Navigation.Root>
        <AppNavigation features={features} />
        <Outlet />
      </Navigation.Root>
    </Layout>
  );
}

const SignOutMenuItem = ({
  synapseRoot,
  credentials,
}: {
  synapseRoot: string;
  credentials: { serverName: string; clientId: string; refreshToken: string };
}) => {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const clear = useAuthStore((state) => state.clear);
  const navigate = Route.useNavigate();

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { revocation_endpoint } = await queryClient.query({
        ...authMetadataQuery(synapseRoot),
        staleTime: "static",
      });

      await revokeToken(
        revocation_endpoint,
        credentials.refreshToken,
        credentials.clientId,
        "refresh_token",
      );
    },
    throwOnError: true,
    onSuccess: async () => {
      await clear();
      await navigate({ to: "/", reloadDocument: true });
    },
  });

  return (
    <MenuItem
      label={intl.formatMessage(messages.actionSignOut)}
      kind="critical"
      Icon={SignOutIcon}
      onSelect={(event) => {
        event.preventDefault();
        signOutMutation.mutate();
      }}
      disabled={signOutMutation.isPending}
    />
  );
};
