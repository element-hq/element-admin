import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SignOutIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { MenuItem, Separator } from "@vector-im/compound-web";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useIntl } from "react-intl";

import { authMetadataQuery, revokeToken } from "@/api/auth";
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
import { useAuthStore } from "@/stores/auth";
import { useImageBlob } from "@/utils/blob";

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
  beforeLoad: () => {
    const state = useAuthStore.getState();
    if (!state.credentials) {
      throw redirect({ to: "/login" });
    }

    return {
      credentials: state.credentials,
    };
  },

  loader: async ({ context: { credentials, queryClient } }) => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    const whoami = await queryClient.ensureQueryData(whoamiQuery(synapseRoot));
    await queryClient.ensureQueryData(
      profileQuery(synapseRoot, whoami.user_id),
    );
  },

  component: RouteComponent,
});

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const { data: whoami } = useSuspenseQuery(whoamiQuery(synapseRoot));

  const { data: profile } = useSuspenseQuery(
    profileQuery(synapseRoot, whoami.user_id),
  );

  const { data: avatar } = useQuery(
    mediaThumbnailQuery(synapseRoot, profile.avatar_url),
  );

  const avatarUrl = useImageBlob(avatar);

  // Temporary thing to show off the logo variants
  const variants = ["pro", "community", "ti-m"] as const;
  const [logoClicks, setLogoClicks] = useState(0);
  const onLogoClick = useCallback(
    () => setLogoClicks((n) => n + 1),
    [setLogoClicks],
  );

  useEffect(() => {
    if (logoClicks > 20) {
      toast("Oh, well.");
    } else if (logoClicks > 15) {
      const promise = new Promise((_, reject) => setTimeout(reject, 2000));
      toast.promise(promise, {
        loading: "Finding reasons why you kept clicking…",
        error: "No sensible reason found.",
      });
    } else if (logoClicks > 10) {
      toast.error("But like, really, stop.");
    } else if (logoClicks > 5) {
      toast.success("Okay you can stop clicking now.");
    }
  }, [logoClicks]);

  const variant = variants[logoClicks % variants.length] || variants[0];

  return (
    <Layout>
      <Header.Root>
        <Header.Left>
          <ElementLogo variant={variant} onClick={onLogoClick} />
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
            <Separator />
            <SignOutMenuItem
              synapseRoot={synapseRoot}
              credentials={credentials}
            />
          </Header.UserMenu>
        </Header.Right>
      </Header.Root>

      <Outlet />
    </Layout>
  );
}

const SignOutMenuItem = ({
  synapseRoot,
  credentials,
}: {
  synapseRoot: string;
  credentials: { serverName: string; clientId: string; accessToken: string };
}) => {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const clear = useAuthStore((state) => state.clear);
  const navigate = Route.useNavigate();

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { revocation_endpoint } = await queryClient.ensureQueryData(
        authMetadataQuery(synapseRoot),
      );

      await revokeToken(
        revocation_endpoint,
        credentials.accessToken,
        credentials.clientId,
      );
    },
    throwOnError: true,
    onSuccess: () => {
      clear();
      navigate({ to: "/", reloadDocument: true });
    },
  });

  return (
    <MenuItem
      label={intl.formatMessage({
        id: "action.sign_out",
        defaultMessage: "Sign out",
        description: "Label for the sign out menu item",
      })}
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
