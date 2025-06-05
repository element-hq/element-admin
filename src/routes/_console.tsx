import {
  Outlet,
  createFileRoute,
  createLink,
  redirect,
} from "@tanstack/react-router";
import {
  ChatIcon,
  HomeSolidIcon,
  KeyIcon,
  SignOutIcon,
  UserIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  type ComponentProps,
  type ComponentType,
  type SVGAttributes,
  forwardRef,
} from "react";

import { authMetadataQuery } from "@/api/auth";
import { revokeToken } from "@/api/auth";
import { wellKnownQuery, whoamiQuery } from "@/api/matrix";
import { useAuthStore } from "@/stores/auth";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Button, H1, Text } from "@vector-im/compound-web";

type SectionLinkProps = {
  Icon: ComponentType<SVGAttributes<SVGElement>>;
} & ComponentProps<"a">;

const SectionLinkComponent = forwardRef<HTMLAnchorElement, SectionLinkProps>(
  ({ Icon, children, ...props }, ref) => (
    <a
      {...props}
      ref={ref}
      className={
        "px-3 py-2 rounded-md flex gap-3 items-center " +
        "data-[status=active]:bg-bg-subtle-secondary " +
        "text-text-secondary hover:text-text-primary data-[status=active]:text-text-primary"
      }
    >
      <Icon className="w-6 h-6" />
      <Text weight="medium" size="md">
        {children}
      </Text>
    </a>
  ),
);

const SectionLink = createLink(SectionLinkComponent);

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
      <div className="h-full flex flex-col gap-20">
        <div className="border-b-2 border-b-bg-subtle-primary">
          <div className="container mx-auto flex items-center justify-between py-5">
            <H1>Admin Console</H1>
            <div className="flex items-center gap-4">
              <Text weight="medium" size="sm" className="text-text-secondary">
                {whoami.user_id}
              </Text>
              <SignOutButton
                synapseRoot={synapseRoot}
                credentials={credentials}
              />
            </div>
          </div>
        </div>
        <div className="container mx-auto">
          <div className="flex gap-12">
            <div className="w-50 gap-1 flex flex-col">
              <SectionLink Icon={HomeSolidIcon} to="/">
                Home
              </SectionLink>
              <SectionLink Icon={UserIcon} to="/users">
                Users
              </SectionLink>
              <SectionLink Icon={KeyIcon} to="/registration-tokens">
                Registration tokens
              </SectionLink>
              <SectionLink Icon={ChatIcon} to="/rooms">
                Rooms
              </SectionLink>
            </div>
            <div className="flex-1">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    );
  },
});

const SignOutButton = ({
  synapseRoot,
  credentials,
}: {
  synapseRoot: string;
  credentials: { serverName: string; clientId: string; accessToken: string };
}) => {
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
    onSuccess: () => {
      clear();
      navigate({ to: "/", reloadDocument: true });
    },
  });

  return (
    <Button
      type="button"
      size="sm"
      destructive
      kind="secondary"
      onClick={() => signOutMutation.mutate()}
      disabled={signOutMutation.isPending}
      Icon={SignOutIcon}
    >
      Sign out
    </Button>
  );
};
