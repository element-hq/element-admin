/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Badge,
  Button,
  H1,
  H3,
  Text,
  InlineSpinner,
} from "@vector-im/compound-web";

import {
  deactivateUser,
  lockUser,
  unlockUser,
  userEmailsQuery,
  userQuery,
} from "@/api/mas";
import { ButtonLink } from "@/components/link";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

export const Route = createFileRoute("/_console/users/$userId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    await Promise.all([
      queryClient.ensureQueryData(
        userQuery(credentials.serverName, params.userId),
      ),
      queryClient.ensureQueryData(
        userEmailsQuery(credentials.serverName, params.userId),
      ),
    ]);
  },
  component: RouteComponent,
});

interface LockUnlockButtonProps {
  user: {
    id: string;
    attributes: {
      locked_at?: string | null;
    };
  };
  serverName: string;
  disabled?: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
}

function LockUnlockButton({
  user,
  serverName,
  queryClient,
  disabled,
}: LockUnlockButtonProps) {
  const isLocked = !!user.attributes.locked_at;

  const lockMutation = useMutation({
    mutationFn: () => lockUser(queryClient, serverName, user.id),
    throwOnError: true,
    onSuccess: () => {
      // Invalidate both the individual user query and the users list
      queryClient.invalidateQueries({
        queryKey: ["mas", "user", serverName, user.id],
      });
      queryClient.invalidateQueries({ queryKey: ["mas", "users", serverName] });
    },
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockUser(queryClient, serverName, user.id),
    throwOnError: true,
    onSuccess: () => {
      // Invalidate both the individual user query and the users list
      queryClient.invalidateQueries({
        queryKey: ["mas", "user", serverName, user.id],
      });
      queryClient.invalidateQueries({ queryKey: ["mas", "users", serverName] });
    },
  });

  const handleClick = () => {
    if (disabled) return;
    if (isLocked) {
      unlockMutation.mutate();
    } else {
      lockMutation.mutate();
    }
  };

  const isLoading = lockMutation.isPending || unlockMutation.isPending;

  return (
    <Button
      type="button"
      size="sm"
      onClick={handleClick}
      disabled={disabled || isLoading}
    >
      {isLoading && <InlineSpinner />}
      {isLocked ? "Unlock User" : "Lock User"}
    </Button>
  );
}

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const { userId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(userQuery(credentials.serverName, userId));

  const { data: emailsData } = useSuspenseQuery(
    userEmailsQuery(credentials.serverName, userId),
  );

  const user = data.data;

  const deactivated = user.attributes.deactivated_at !== null;

  const deactivateMutation = useMutation({
    mutationFn: () =>
      deactivateUser(queryClient, credentials.serverName, userId),
    throwOnError: true,
    onSuccess: () => {
      // Invalidate both the individual user query and the users list
      queryClient.invalidateQueries({
        queryKey: ["mas", "user", credentials.serverName, userId],
      });
      queryClient.invalidateQueries({
        queryKey: ["mas", "users", credentials.serverName],
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ButtonLink
            to="/users"
            kind="secondary"
            size="sm"
            Icon={ArrowLeftIcon}
          >
            Back to Users
          </ButtonLink>
          <H1>User Details</H1>
        </div>
      </div>

      <div className="bg-bg-subtle-secondary rounded-lg">
        <div className="px-6 py-5 border-b border-border-interactive-secondary">
          <H3>{user.attributes.username}</H3>
          <Text size="sm" className="text-text-secondary">
            User ID: {user.id}
          </Text>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Text size="sm" weight="medium">
                Status
              </Text>
              <Badge
                kind={
                  user.attributes.deactivated_at
                    ? "red"
                    : user.attributes.locked_at
                      ? "grey"
                      : "blue"
                }
              >
                {user.attributes.deactivated_at
                  ? "Deactivated"
                  : user.attributes.locked_at
                    ? "Locked"
                    : "Active"}
              </Badge>
            </div>

            <div>
              <Text size="sm" weight="medium">
                Admin Privileges
              </Text>
              <Badge kind={user.attributes.admin ? "green" : "grey"}>
                {user.attributes.admin ? "Admin" : "User"}
              </Badge>
            </div>

            <div>
              <Text size="sm" weight="medium">
                Created At
              </Text>
              <Text size="sm">
                {computeHumanReadableDateTimeStringFromUtc(
                  user.attributes.created_at,
                )}
              </Text>
            </div>

            {user.attributes.locked_at && (
              <div>
                <Text size="sm" weight="medium">
                  Locked At
                </Text>
                <Text size="sm">
                  {computeHumanReadableDateTimeStringFromUtc(
                    user.attributes.locked_at,
                  )}
                </Text>
              </div>
            )}
          </div>

          <div>
            <Text size="sm" weight="medium">
              Email Addresses ({emailsData.data.length})
            </Text>
            {emailsData.data.length > 0 ? (
              <div className="space-y-2">
                {emailsData.data.map((emailItem) => (
                  <div
                    key={emailItem.id}
                    className="flex items-center justify-between p-3 bg-bg-subtle-primary rounded-md"
                  >
                    <Text size="sm">{emailItem.attributes.email}</Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text size="sm">No email addresses found</Text>
            )}
          </div>

          <div className="pt-5 border-t border-border-interactive-secondary">
            <Text
              size="sm"
              weight="medium"
              className="text-text-secondary mb-4"
            >
              Actions
            </Text>
            <div className="flex gap-3">
              <LockUnlockButton
                user={user}
                serverName={credentials.serverName}
                queryClient={queryClient}
                disabled={deactivated}
              />
              <Button
                type="button"
                size="sm"
                kind="tertiary"
                destructive
                disabled={deactivateMutation.isPending || deactivated}
                onClick={() => deactivateMutation.mutate()}
              >
                {deactivateMutation.isPending && (
                  <InlineSpinner className="mr-2" />
                )}
                Deactivate User
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
