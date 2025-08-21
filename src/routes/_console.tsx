import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import {
  DocumentIcon,
  HomeIcon,
  KeyIcon,
  LeaveIcon,
  SignOutIcon,
  UserProfileIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Link, MenuItem, Separator } from "@vector-im/compound-web";
import { FormattedMessage, useIntl } from "react-intl";

import { authMetadataQuery, revokeToken } from "@/api/auth";
import {
  mediaThumbnailQuery,
  profileQuery,
  wellKnownQuery,
  whoamiQuery,
} from "@/api/matrix";
import { CopyToClipboard } from "@/components/copy";
import { useAuthStore } from "@/stores/auth";
import * as Header from "@/components/header";
import { EssLogotype } from "@/components/logo";
import * as Navigation from "@/components/navigation";
import * as Footer from "@/components/footer";
import { Layout } from "@/components/layout";
import { useImageBlob } from "@/utils/blob";

const TokenView: React.FC<{ token: string }> = ({ token }) => (
  <div className="flex items-center justify-between py-2 px-4 gap-1 text-text-secondary font-mono text-xs">
    {token.length > 20
      ? `${token.slice(0, 5)}${"•".repeat(5)}${token.slice(Math.max(0, token.length - 7))}`
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

    const whoami = await queryClient.ensureQueryData(
      whoamiQuery(queryClient, synapseRoot),
    );
    await queryClient.ensureQueryData(
      profileQuery(queryClient, synapseRoot, whoami.user_id),
    );
  },

  component: RouteComponent,
});

function RouteComponent() {
  const queryClient = useQueryClient();
  const { credentials } = Route.useRouteContext();
  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const { data: whoami } = useSuspenseQuery(
    whoamiQuery(queryClient, synapseRoot),
  );

  const { data: profile } = useSuspenseQuery(
    profileQuery(queryClient, synapseRoot, whoami.user_id),
  );

  const { data: avatar } = useQuery(
    mediaThumbnailQuery(queryClient, synapseRoot, profile.avatar_url),
  );

  const avatarUrl = useImageBlob(avatar);

  return (
    // The z-index is needed to create a new stacking context, so that the
    // header can be above the content
    <Layout>
      <Header.Root>
        <Header.Left>
          <EssLogotype />
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
          <Navigation.Divider />
          <Navigation.NavAnchor
            Icon={DocumentIcon}
            href="https://docs.element.io/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FormattedMessage
              id="navigation.documentation"
              defaultMessage="Documentation"
              description="Label for the documentation navigation link (to https://docs.element.io/) in the main navigation sidebar"
            />
          </Navigation.NavAnchor>
        </Navigation.Sidebar>

        <Navigation.Content>
          <Outlet />

          <Footer.Root>
            <Footer.PoweredBy />

            <Footer.Section>
              <Link href="https://ems.element.io/support" size="small">
                <FormattedMessage
                  id="footer.help_and_support"
                  defaultMessage="Help & Support"
                  description="Label for the help and support (to https://ems.element.io/support) link in the footer"
                />
              </Link>
              <Footer.Divider />
              <Link href="https://element.io/legal" size="small">
                <FormattedMessage
                  id="footer.legal"
                  defaultMessage="Legal"
                  description="Label for the legal (to https://element.io/legal) link in the footer"
                />
              </Link>
              <Footer.Divider />
              <Link href="https://element.io/legal/privacy" size="small">
                <FormattedMessage
                  id="footer.privacy"
                  defaultMessage="Privacy"
                  description="Label for the privacy (to https://element.io/legal/privacy) link in the footer"
                />
              </Link>
            </Footer.Section>

            <Footer.Divider />

            <Footer.Section>
              <Footer.CopyrightNotice />
            </Footer.Section>
          </Footer.Root>
        </Navigation.Content>
      </Navigation.Root>
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
