/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  LockIcon,
  DeleteIcon,
  CheckCircleIcon,
  KeyIcon,
  CloseIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Badge,
  Button,
  Text,
  InlineSpinner,
  Alert,
  Form,
  Tooltip,
} from "@vector-im/compound-web";
import { useCallback, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import {
  deactivateUser,
  lockUser,
  reactivateUser,
  setUserPassword,
  unlockUser,
  userEmailsQuery,
  userQuery,
} from "@/api/mas";
import { profileQuery, wellKnownQuery } from "@/api/matrix";
import * as Data from "@/components/data";
import * as Dialog from "@/components/dialog";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import { UserAvatar } from "@/components/room-info";
import * as messages from "@/messages";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";

export const Route = createFileRoute("/_console/users/$userId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    // Fire the email query as soon as possible without awaiting it
    const emailPromise = queryClient.ensureQueryData(
      userEmailsQuery(credentials.serverName, params.userId),
    );
    const userPromise = queryClient.ensureQueryData(
      userQuery(credentials.serverName, params.userId),
    );
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    const { data: user } = await userPromise;
    const mxid = `@${user.attributes.username}:${credentials.serverName}`;
    await queryClient.ensureQueryData(profileQuery(synapseRoot, mxid));
    await emailPromise;
  },
  component: RouteComponent,
});

interface UserChipProps {
  mxid: string;
  synapseRoot: string;
}

function UserChip({ mxid, synapseRoot }: UserChipProps) {
  const { data: profile } = useQuery(profileQuery(synapseRoot, mxid));
  const displayName = profile?.displayname;
  return (
    <div className="border border-bg-subtle-primary p-3 flex gap-3 items-center">
      <UserAvatar synapseRoot={synapseRoot} userId={mxid} size="32px" />
      <div className="flex flex-col">
        <Text size="md" weight="semibold" className="text-text-primary">
          {mxid}
        </Text>
        {displayName && (
          <Text size="sm" weight="regular" className="text-text-secondary">
            {displayName}
          </Text>
        )}
      </div>
    </div>
  );
}

interface LockUnlockButtonProps {
  user: {
    id: string;
    attributes: {
      username: string;
      locked_at?: string | null;
    };
  };
  serverName: string;
  synapseRoot: string;
  mxid: string;
}

interface DeactivateReactivateButtonProps {
  user: {
    id: string;
    attributes: {
      username: string;
      deactivated_at?: string | null;
    };
  };
  serverName: string;
  synapseRoot: string;
  mxid: string;
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
      size="sm"
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

function ReactivateButton({
  user,
  serverName,
}: DeactivateReactivateButtonProps) {
  const queryClient = useQueryClient();
  const intl = useIntl();
  const { mutate, isPending } = useMutation({
    mutationFn: () => reactivateUser(queryClient, serverName, user.id),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.reactivate_account.error",
          defaultMessage: "Failed to reactivate account",
          description: "The error message for reactivating a user account",
        }),
      );
    },
    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.reactivate_account.success",
          defaultMessage: "Account reactivated",
          description: "The success message for reactivating a user account",
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
      size="sm"
      Icon={isPending ? undefined : CheckCircleIcon}
    >
      {isPending && <InlineSpinner />}
      <FormattedMessage
        id="pages.users.reactivate_account.button"
        defaultMessage="Reactivate"
        description="The label for the reactivate account button on the user panel"
      />
    </Button>
  );
}

const deactivateAccountMessage = defineMessage({
  id: "pages.users.deactivate_account.button",
  defaultMessage: "Deactivate account",
  description: "The label for the deactivate account button on the user panel",
});

function DeactivateButton({
  user,
  serverName,
  mxid,
  synapseRoot,
}: DeactivateReactivateButtonProps) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useMutation({
    mutationFn: () => deactivateUser(queryClient, serverName, user.id),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.deactivate_account.error",
          defaultMessage: "Failed to deactivate account",
          description: "The error message for deactivating a user account",
        }),
      );
    },
    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.deactivate_account.success",
          defaultMessage: "Account deactivated",
          description: "The success message for deactivating a user account",
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
          Icon={DeleteIcon}
        >
          <FormattedMessage {...deactivateAccountMessage} />
        </Button>
      }
    >
      <Dialog.Title>
        <FormattedMessage
          id="pages.users.deactivate_account.title"
          defaultMessage="Deactivate this user?"
          description="The title of the modal asking for confirmation to deactivate a user account"
        />
      </Dialog.Title>
      <UserChip mxid={mxid} synapseRoot={synapseRoot} />
      <Dialog.Description asChild>
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: "pages.users.deactivate_account.alert.title",
            description:
              "In the modal to deactivate a user, the title of the alert",
            defaultMessage: "You're about to delete user data",
          })}
        >
          <FormattedMessage
            id="pages.users.deactivate_account.alert.description"
            description="In the modal to deactivate a user, the description of the alert"
            defaultMessage="This will automatically sign the user out of all devices, remove any access tokens, delete all third-party IDs, and permanently erase their account data."
          />
        </Alert>
      </Dialog.Description>
      <Button
        type="button"
        kind="primary"
        destructive
        disabled={isPending}
        onClick={handleClick}
        Icon={isPending ? undefined : DeleteIcon}
      >
        {isPending && <InlineSpinner />}
        <FormattedMessage {...deactivateAccountMessage} />
      </Button>
      <Dialog.Close asChild>
        <Button type="button" kind="tertiary" disabled={isPending}>
          <FormattedMessage {...messages.actionCancel} />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
  );
}

const lockAccountMessage = defineMessage({
  id: "pages.users.lock_account.button",
  defaultMessage: "Lock account",
  description: "The label for the lock account button on the user panel",
});

function LockButton({
  user,
  serverName,
  synapseRoot,
  mxid,
}: LockUnlockButtonProps) {
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
      <UserChip mxid={mxid} synapseRoot={synapseRoot} />
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
          <FormattedMessage {...messages.actionCancel} />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
  );
}

interface SetPasswordButtonProps {
  user: {
    id: string;
    attributes: {
      username: string;
    };
  };
  serverName: string;
  synapseRoot: string;
  mxid: string;
}

function SetPasswordButton({
  user,
  serverName,
  synapseRoot,
  mxid,
}: SetPasswordButtonProps) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const otherPasswordRef = useRef<HTMLInputElement>(null);

  const { mutate, isPending } = useMutation({
    // TODO: we always skip the server check for now?
    mutationFn: (password: string) =>
      setUserPassword(queryClient, serverName, user.id, password, true),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.set_password.error",
          defaultMessage: "Failed to set password",
          description:
            "The error message when the request for setting a user password fails",
        }),
      );
    },
    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.set_password.success",
          defaultMessage: "Password set successfully",
          description: "The success message for setting a user password",
        }),
      );
      setOpen(false);
      formRef.current?.reset();
    },
  });

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (isPending) {
        return;
      }
      setOpen(open);
      if (!open) {
        formRef.current?.reset();
      }
    },
    [isPending],
  );

  // Whenever there is an input on the first password field, we trigger a
  // validation on the second input (if there is anything there), so that the
  // 'password match/don't match' gets updated
  const onPasswordInput = useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>) => {
      if (otherPasswordRef.current && otherPasswordRef.current.value) {
        otherPasswordRef.current.reportValidity();
      }
    },
    [otherPasswordRef],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const password = formData.get("password") as string;
      mutate(password);
    },
    [mutate],
  );

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      trigger={
        <Button type="button" size="sm" kind="secondary" Icon={KeyIcon}>
          <FormattedMessage
            id="pages.users.set_password.button"
            defaultMessage="Change password"
            description="The label for the change password button on the user panel"
          />
        </Button>
      }
    >
      <Dialog.Title>
        <FormattedMessage
          id="pages.users.set_password.title"
          defaultMessage="Set a new password for this user"
          description="The title of the modal for setting a user password"
        />
      </Dialog.Title>
      <UserChip mxid={mxid} synapseRoot={synapseRoot} />
      <Dialog.Description asChild>
        <Form.Root ref={formRef} onSubmit={handleSubmit}>
          <Form.Field name="password">
            <Form.Label>
              <FormattedMessage
                id="pages.users.set_password.password_label"
                defaultMessage="Password"
                description="Label for the password field in set password modal"
              />
            </Form.Label>
            <Form.PasswordControl
              disabled={isPending}
              required
              onInput={onPasswordInput}
            />
            <Form.ErrorMessage match="valueMissing">
              <FormattedMessage
                id="pages.users.set_password.error.password_missing"
                defaultMessage="This field is required"
                description="Error message for missing password in set password modal"
              />
            </Form.ErrorMessage>
          </Form.Field>

          <Form.Field name="confirmPassword">
            <Form.Label>
              <FormattedMessage
                id="pages.users.set_password.confirm_password_label"
                defaultMessage="Enter password again"
                description="Label for the confirm password field in set password modal"
              />
            </Form.Label>
            <Form.PasswordControl
              ref={otherPasswordRef}
              disabled={isPending}
              required
            />
            <Form.ErrorMessage match="valueMissing">
              <FormattedMessage
                id="pages.users.set_password.error.password_missing"
                defaultMessage="This field is required"
                description="Error message for missing password in set password modal"
              />
            </Form.ErrorMessage>

            <Form.ErrorMessage match={(v, form) => v !== form.get("password")}>
              <FormattedMessage
                id="pages.users.set_password.error.passwords_mismatch"
                defaultMessage="Passwords do not match"
                description="Error message for mismatched passwords in set password modal"
              />
            </Form.ErrorMessage>

            <Form.SuccessMessage match="valid">
              <FormattedMessage
                id="pages.users.set_password.password_match"
                defaultMessage="Passwords match!"
                description="When the two password input match in the set password modal"
              />
            </Form.SuccessMessage>
          </Form.Field>

          <Form.Submit disabled={isPending}>
            {isPending && <InlineSpinner />}
            <FormattedMessage
              id="pages.users.set_password.submit"
              defaultMessage="Set new password"
              description="The submit button text in the set password modal"
            />
          </Form.Submit>
        </Form.Root>
      </Dialog.Description>

      <Dialog.Close asChild>
        <Button type="button" kind="tertiary" disabled={isPending}>
          <FormattedMessage {...messages.actionCancel} />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
  );
}

function RouteComponent() {
  const intl = useIntl();
  const { credentials } = Route.useRouteContext();
  const { userId } = Route.useParams();

  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;

  const {
    data: { data: user },
  } = useSuspenseQuery(userQuery(credentials.serverName, userId));
  // TODO: this should be in a helper
  const mxid = `@${user.attributes.username}:${credentials.serverName}`;

  const { data: profile } = useQuery(profileQuery(synapseRoot, mxid));
  const displayName = profile?.displayname;

  const { data: emailsData } = useSuspenseQuery(
    userEmailsQuery(credentials.serverName, userId),
  );

  const deactivated = user.attributes.deactivated_at !== null;
  const locked = user.attributes.locked_at !== null;

  return (
    <Navigation.Details>
      <div className="flex items-center justify-end">
        <Tooltip label={intl.formatMessage(messages.actionClose)}>
          <ButtonLink
            iconOnly
            to="/users"
            kind="tertiary"
            size="sm"
            Icon={CloseIcon}
          />
        </Tooltip>
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4">
          <UserAvatar synapseRoot={synapseRoot} userId={mxid} size="88px" />
          <div className="flex flex-col gap-2 items-center text-text-primary">
            <Text size="lg" weight="semibold">
              {mxid}
            </Text>
            {displayName && <Text size="md">{displayName}</Text>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {locked && !deactivated && (
            <UnlockButton
              user={user}
              serverName={credentials.serverName}
              synapseRoot={synapseRoot}
              mxid={mxid}
            />
          )}

          {!locked && !deactivated && (
            <LockButton
              user={user}
              serverName={credentials.serverName}
              synapseRoot={synapseRoot}
              mxid={mxid}
            />
          )}

          {deactivated && (
            <ReactivateButton
              user={user}
              serverName={credentials.serverName}
              synapseRoot={synapseRoot}
              mxid={mxid}
            />
          )}

          {!deactivated && (
            <DeactivateButton
              user={user}
              serverName={credentials.serverName}
              synapseRoot={synapseRoot}
              mxid={mxid}
            />
          )}

          {!deactivated && (
            <SetPasswordButton
              user={user}
              serverName={credentials.serverName}
              synapseRoot={synapseRoot}
              mxid={mxid}
            />
          )}
        </div>

        <Data.Grid>
          <Data.Item>
            <Data.Title>Status</Data.Title>
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
          </Data.Item>

          <Data.Item>
            <Data.Title>Admin Privileges</Data.Title>
            <Badge kind={user.attributes.admin ? "green" : "grey"}>
              {user.attributes.admin ? "Admin" : "User"}
            </Badge>
          </Data.Item>

          <Data.Item>
            <Data.Title>Created At</Data.Title>
            <Data.Value>
              {computeHumanReadableDateTimeStringFromUtc(
                user.attributes.created_at,
              )}
            </Data.Value>
          </Data.Item>

          {user.attributes.locked_at && (
            <Data.Item>
              <Data.Title>Locked At</Data.Title>
              <Data.Value>
                {computeHumanReadableDateTimeStringFromUtc(
                  user.attributes.locked_at,
                )}
              </Data.Value>
            </Data.Item>
          )}

          <Data.Item>
            <Data.Title>Email Addresses ({emailsData.data.length})</Data.Title>
            {emailsData.data.length > 0 ? (
              emailsData.data.map((emailItem) => (
                <Data.Value key={emailItem.id}>
                  {emailItem.attributes.email}
                </Data.Value>
              ))
            ) : (
              <Data.Value>No email addresses found</Data.Value>
            )}
          </Data.Item>
        </Data.Grid>
      </div>
    </Navigation.Details>
  );
}
