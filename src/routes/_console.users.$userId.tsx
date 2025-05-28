import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Text } from "@vector-im/compound-web";

import { userQuery } from "@/api/mas";

export const Route = createFileRoute("/_console/users/$userId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    await queryClient.ensureQueryData(
      userQuery(queryClient, credentials.serverName, params.userId),
    );
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const { userId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery(
    userQuery(queryClient, credentials.serverName, userId),
  );

  const user = data.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/users">
            <Button kind="secondary" size="sm">
              ← Back to Users
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
              <Text size="sm" weight="medium" className="text-gray-700 mb-2">
                Status
              </Text>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  user.attributes.locked_at
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {user.attributes.locked_at ? "Locked" : "Active"}
              </span>
            </div>

            <div>
              <Text size="sm" weight="medium" className="text-gray-700 mb-2">
                Admin Privileges
              </Text>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  user.attributes.admin
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {user.attributes.admin ? "Admin" : "User"}
              </span>
            </div>

            <div>
              <Text size="sm" weight="medium" className="text-gray-700 mb-2">
                Created At
              </Text>
              <Text size="sm">
                {new Date(user.attributes.created_at).toLocaleString()}
              </Text>
            </div>

            {user.attributes.locked_at && (
              <div>
                <Text size="sm" weight="medium" className="text-gray-700 mb-2">
                  Locked At
                </Text>
                <Text size="sm">
                  {new Date(user.attributes.locked_at).toLocaleString()}
                </Text>
              </div>
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
              <Button
                size="sm"
                kind={user.attributes.locked_at ? "primary" : "secondary"}
                disabled
              >
                {user.attributes.locked_at ? "Unlock User" : "Lock User"}
              </Button>
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