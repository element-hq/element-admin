/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  LockIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Badge,
  Button,
  H1,
  H3,
  Text,
  InlineSpinner,
  Alert,
} from "@vector-im/compound-web";
import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import {
  deactivateUser,
  lockUser,
  unlockUser,
  userEmailsQuery,
  userQuery,
} from "@/api/mas";
import * as Dialog from "@/components/dialog";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
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

const cancelMessage = defineMessage({
  id: "action.cancel",
  description: "Label for a cancel action/button",
  defaultMessage: "Cancel",
});

interface LockUnlockButtonProps {
  user: {
    id: string;
    attributes: {
      username: string;
      locked_at?: string | null;
    };
  };
  serverName: string;
}

function UnlockButton({ user, serverName }: LockUnlockButtonProps) {
  const queryClient = useQueryClient();
  const intl = useIntl();
  const { mutate, isPending } = useMutation({
    mutationFn: () => unlockUser(queryClient, serverName, user.id),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.unlock_account.error",
          defaultMessage: "Failed to unlock account",
          description: "The error message for unlocking a user account",
        }),
      );
    },
    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.unlock_account.success",
          defaultMessage: "Account unlocked",
          description: "The success message for unlocking a user account",
        }),
      );

      // Invalidate both the individual user query and the users list
      queryClient.invalidateQueries({ queryKey: ["mas", "users", serverName] });

      // We await on the individual user invalidation query invalidation so that
      // the query stays in a pending state until the new data is loaded
      await queryClient.invalidateQueries({
        queryKey: ["mas", "user", serverName, user.id],
      });
    },
  });

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (isPending) return;
      mutate();
    },
    [mutate, isPending],
  );

  return (
    <Button
      type="button"
      kind="secondary"
      disabled={isPending}
      onClick={onClick}
    >
      {isPending && <InlineSpinner />}
      <FormattedMessage
        id="pages.users.unlock_account.button"
        defaultMessage="Unlock account"
        description="The label for the lock account button on the user panel"
      />
    </Button>
  );
}

const lockAccountMessage = defineMessage({
  id: "pages.users.lock_account.button",
  defaultMessage: "Lock account",
  description: "The label for the lock account button on the user panel",
});

function LockButton({ user, serverName }: LockUnlockButtonProps) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useMutation({
    mutationFn: () => lockUser(queryClient, serverName, user.id),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.lock_account.error",
          defaultMessage: "Failed to lock account",
          description: "The error message for locking a user account",
        }),
      );
    },
    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.lock_account.success",
          defaultMessage: "Account locked",
          description: "The success message for locking a user account",
        }),
      );

      // Invalidate both the individual user query and the users list
      queryClient.invalidateQueries({ queryKey: ["mas", "users", serverName] });

      // We await on the individual user invalidation query invalidation so that
      // the query stays in a pending state until the new data is loaded
      await queryClient.invalidateQueries({
        queryKey: ["mas", "user", serverName, user.id],
      });
      setOpen(false);
    },
  });

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (isPending) {
        return;
      }

      setOpen(open);
    },
    [setOpen, isPending],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      mutate();
    },
    [mutate],
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <Button
          type="button"
          size="sm"
          kind="secondary"
          destructive
          Icon={LockIcon}
        >
          <FormattedMessage {...lockAccountMessage} />
        </Button>
      }
    >
      <Dialog.Title>
        <FormattedMessage
          id="pages.users.lock_account.title"
          defaultMessage="Lock this user's account?"
          description="The title of the modal asking for confirmation to lock a user account"
        />
      </Dialog.Title>
      {/* TODO: user avatar, display name, better style */}
      <p className="text-text-secondary border border-bg-subtle-primary p-3 leading-10">
        <Text
          weight="semibold"
          size="md"
          as="span"
          className="text-text-primary"
        >
          @{user.attributes.username}
        </Text>
        :{serverName}
      </p>
      <Dialog.Description asChild>
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: "pages.users.lock_account.alert.title",
            description: "In the modal to lock a user, the title of the alert",
            defaultMessage:
              "The user will not be able to send or receive messages",
          })}
        >
          <FormattedMessage
            id="pages.users.lock_account.alert.description"
            description="In the modal to lock a user, the description of the alert"
            defaultMessage="This user will automatically locked out of any devices they are currently signed into and won't be able to sign into any new devices until they have been unlocked."
          />
        </Alert>
      </Dialog.Description>
      <Button
        type="button"
        kind="primary"
        destructive
        disabled={isPending}
        onClick={handleClick}
        Icon={isPending ? undefined : LockIcon}
      >
        {isPending && <InlineSpinner />}
        <FormattedMessage {...lockAccountMessage} />
      </Button>
      <Dialog.Close asChild>
        <Button type="button" kind="tertiary" disabled={isPending}>
          <FormattedMessage {...cancelMessage} />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
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
    <Navigation.Details>
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

            {user.attributes.locked_at !== null && (
              <UnlockButton user={user} serverName={credentials.serverName} />
            )}

            {user.attributes.locked_at === null && (
              <LockButton user={user} serverName={credentials.serverName} />
            )}

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
    </Navigation.Details>
  );
}
