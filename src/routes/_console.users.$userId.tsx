import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Badge, Button, InlineSpinner, Text } from "@vector-im/compound-web";

import { lockUser, unlockUser, userEmailsQuery, userQuery } from "@/api/mas";

export const Route = createFileRoute("/_console/users/$userId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    await Promise.all([
      queryClient.ensureQueryData(
        userQuery(queryClient, credentials.serverName, params.userId),
      ),
      queryClient.ensureQueryData(
        userEmailsQuery(queryClient, credentials.serverName, params.userId),
      ),
    ]);
  },
  component: RouteComponent,
});

interface LockUnlockButtonProps {
  user: {
    id: string;
    attributes: {
      locked_at: string | null;
    };
  };
  serverName: string;
  queryClient: ReturnType<typeof useQueryClient>;
}

function LockUnlockButton({
  user,
  serverName,
  queryClient,
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
    if (isLocked) {
      unlockMutation.mutate();
    } else {
      lockMutation.mutate();
    }
  };

  const isLoading = lockMutation.isPending || unlockMutation.isPending;

  return (
    <Button size="sm" onClick={handleClick} disabled={isLoading}>
      {isLoading && <InlineSpinner />}
      {isLocked ? "Unlock User" : "Lock User"}
    </Button>
  );
}

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const { userId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    userQuery(queryClient, credentials.serverName, userId),
  );

  const { data: emailsData } = useSuspenseQuery(
    userEmailsQuery(queryClient, credentials.serverName, userId),
  );

  const user = data.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/users">
            <Button kind="secondary" size="sm" Icon={ArrowLeftIcon}>
              Back to Users
            </Button>
          </Link>
          <Text as="h1" size="lg" weight="semibold">
            User Details
          </Text>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-5 border-b border-gray-200">
          <Text as="h3" size="md" weight="semibold">
            {user.attributes.username}
          </Text>
          <Text size="sm" className="text-gray-600">
            User ID: {user.id}
          </Text>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Text size="sm" weight="medium">
                Status
              </Text>
              <Badge kind={user.attributes.locked_at ? "red" : "blue"}>
                {user.attributes.locked_at ? "Locked" : "Active"}
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
                {new Date(user.attributes.created_at).toLocaleString()}
              </Text>
            </div>

            {user.attributes.locked_at && (
              <div>
                <Text size="sm" weight="medium">
                  Locked At
                </Text>
                <Text size="sm">
                  {new Date(user.attributes.locked_at).toLocaleString()}
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
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <Text size="sm">{emailItem.attributes.email}</Text>
                    <Text size="xs">
                      Added{" "}
                      {new Date(
                        emailItem.attributes.created_at,
                      ).toLocaleDateString()}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Text size="sm">No email addresses found</Text>
            )}
          </div>

          <div className="pt-5 border-t border-gray-200">
            <Text size="sm" weight="medium" className="text-gray-700 mb-4">
              Actions
            </Text>
            <div className="flex gap-3">
              <Button size="sm" disabled>
                Edit User
              </Button>
              <Button size="sm" kind="secondary" disabled>
                Reset Password
              </Button>
              <LockUnlockButton
                user={user}
                serverName={credentials.serverName}
                queryClient={queryClient}
              />
              <Button size="sm" kind="tertiary" destructive disabled>
                Deactivate User
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
