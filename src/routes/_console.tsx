import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createFileRoute,
  createLink,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import {
  HomeIcon,
  KeyIcon,
  LeaveIcon,
  SignOutIcon,
  UserProfileIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { MenuItem, Separator } from "@vector-im/compound-web";
import { FormattedMessage, useIntl } from "react-intl";

import { authMetadataQuery, revokeToken } from "@/api/auth";
import { wellKnownQuery, whoamiQuery } from "@/api/matrix";
import { CopyToClipboard } from "@/components/copy";
import { useAuthStore } from "@/stores/auth";
import * as Header from "@/components/header";
import { EssLogo } from "@/components/logo";
import * as Navigation from "@/components/navigation";
import Layout from "@/components/layout";

const TokenView: React.FC<{ token: string }> = ({ token }) => (
  <div className="flex items-center justify-between py-2 px-4 gap-1 text-text-secondary font-mono text-xs">
    {token.length > 20
      ? `${token.substring(0, 5)}${"•".repeat(5)}${token.substring(token.length - 7)}`
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

    await queryClient.ensureQueryData(whoamiQuery(queryClient, synapseRoot));
  },

  component: () => {
    const queryClient = useQueryClient();
    const { credentials } = Route.useRouteContext();
    const { data: wellKnown } = useSuspenseQuery(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;
    const { data: whoami } = useSuspenseQuery(
      whoamiQuery(queryClient, synapseRoot),
    );

    return (
      // The z-index is needed to create a new stacking context, so that the
      // header can be above the content
      <Layout>
        <Header.Root>
          <Header.Left>
            <EssLogo />
            <Header.HomeserverName>
              {credentials.serverName}
            </Header.HomeserverName>
          </Header.Left>

          <Header.Right>
            <Header.UserMenu mxid={whoami.user_id}>
              <Header.UserMenuProfile mxid={whoami.user_id} />
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

        <Navigation.Root>
          <Navigation.Sidebar>
            <Navigation.NavLink Icon={HomeIcon} to="/">
              <FormattedMessage
                id="navigation.dashboard"
                defaultMessage="Dashboard"
                description="Label for the dashboard navigation item in the main navigation sidebar"
              />
            </Navigation.NavLink>
            <Navigation.NavLink Icon={UserProfileIcon} to="/users">
              <FormattedMessage
                id="navigation.users"
                defaultMessage="Users"
                description="Label for the users navigation item in the main navigation sidebar"
              />
            </Navigation.NavLink>
            <Navigation.NavLink Icon={LeaveIcon} to="/rooms">
              <FormattedMessage
                id="navigation.rooms"
                defaultMessage="Rooms"
                description="Label for the rooms navigation item in the main navigation sidebar"
              />
            </Navigation.NavLink>
            <Navigation.Divider />
            <Navigation.NavLink Icon={KeyIcon} to="/registration-tokens">
              <FormattedMessage
                id="navigation.registration_tokens"
                defaultMessage="Registration tokens"
                description="Label for the registration tokens navigation item in the main navigation sidebar"
              />
            </Navigation.NavLink>
          </Navigation.Sidebar>

          <Navigation.Content>
            <Outlet />
          </Navigation.Content>
        </Navigation.Root>
      </Layout>
    );
  },
});

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
      onSelect={(e) => {
        e.preventDefault();
        signOutMutation.mutate();
      }}
      disabled={signOutMutation.isPending}
    />
  );
};
