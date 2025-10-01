// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

/* eslint-disable formatjs/no-literal-string-in-jsx -- Not fully translated */
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircleIcon,
  CloseIcon,
  DeleteIcon,
  KeyIcon,
  LockIcon,
  PlusIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Alert,
  Badge,
  Button,
  Form,
  InlineSpinner,
  Separator,
  Text,
  Tooltip,
} from "@vector-im/compound-web";
import { useCallback, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";

import {
  deactivateUser,
  deleteUpstreamOAuthLink,
  lockUser,
  reactivateUser,
  setUserCanRequestAdmin,
  setUserPassword,
  siteConfigQuery,
  unlockUser,
  userEmailsQuery,
  userQuery,
  userUpstreamLinksQuery,
  deleteUserEmail,
  addUserEmail,
  addUpstreamOAuthLink,
  upstreamProvidersQuery,
} from "@/api/mas";
import type {
  SingleResourceForUpstreamOAuthProvider,
  Ulid,
  UpstreamOAuthLink,
  UserEmail,
} from "@/api/mas/api";
import { profileQuery, wellKnownQuery } from "@/api/matrix";
import * as Data from "@/components/data";
import * as Dialog from "@/components/dialog";
import { ButtonLink } from "@/components/link";
import * as Navigation from "@/components/navigation";
import { UserAvatar } from "@/components/room-info";
import * as messages from "@/messages";
import { computeHumanReadableDateTimeStringFromUtc } from "@/utils/datetime";
import { ensureParametersAreUlids } from "@/utils/parameters";

export const Route = createFileRoute("/_console/users/$userId")({
  loader: async ({ context: { queryClient, credentials }, params }) => {
    ensureParametersAreUlids(params);

    // Fire the queries as soon as possible without awaiting it
    const emailPromise = queryClient.ensureQueryData(
      userEmailsQuery(credentials.serverName, params.userId),
    );
    const upstreamLinksPromise = queryClient.ensureQueryData(
      userUpstreamLinksQuery(credentials.serverName, params.userId),
    );
    // This API might not be available, if it's the case we don't want to throw,
    // so we use prefetchQuery instead of ensureQueryData
    const upstreamProvidersPromise = queryClient.prefetchQuery(
      upstreamProvidersQuery(credentials.serverName),
    );
    const siteConfigPromise = queryClient.ensureQueryData(
      siteConfigQuery(credentials.serverName),
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
    await upstreamLinksPromise;
    await upstreamProvidersPromise;
    await siteConfigPromise;
  },
  component: RouteComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  const { userId } = Route.useParams();
  const {
    credentials: { serverName },
  } = Route.useRouteContext();
  const intl = useIntl();
  return (
    <Navigation.Details className="gap-4">
      <CloseSidebar />

      <Alert
        type="critical"
        title={intl.formatMessage({
          id: "pages.users.not_found.title",
          defaultMessage: "User not found",
          description: "The title of the alert when a user could not be found",
        })}
      >
        <FormattedMessage
          id="pages.users.not_found.description"
          defaultMessage="The requested user ({userId}) could not be found on {serverName}."
          description="The description of the alert when a user could not be found"
          values={{
            userId,
            serverName,
          }}
        />
      </Alert>
    </Navigation.Details>
  );
}

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

interface AdminCheckboxProps {
  user: {
    id: string;
    attributes: {
      username: string;
      admin: boolean;
    };
  };
  mxid: string;
  serverName: string;
  synapseRoot: string;
}
function AdminCheckbox({
  user,
  mxid,
  serverName,
  synapseRoot,
}: AdminCheckboxProps) {
  const queryClient = useQueryClient();
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useMutation({
    mutationFn: (admin: boolean) =>
      setUserCanRequestAdmin(queryClient, serverName, user.id, admin),

    onError() {
      toast.error(
        intl.formatMessage(
          {
            id: "pages.users.set_admin.error",
            defaultMessage: "Failed to change admin privileges for {mxid}",
            description:
              "The error message for changing a user's admin privileges",
          },
          { mxid },
        ),
      );
    },

    async onSuccess(_data, admin): Promise<void> {
      if (admin) {
        toast.success(
          intl.formatMessage(
            {
              id: "pages.users.set_admin.successfully_promoted",
              defaultMessage: "{mxid} now has admin privileges",
              description:
                "The success message when giving admin privileges to a user",
            },
            { mxid },
          ),
        );
      } else {
        toast.success(
          intl.formatMessage(
            {
              id: "pages.users.set_admin.successfully_demoted",
              defaultMessage: "{mxid} no longer has admin privileges",
              description:
                "The success message when removing admin privileges from a user",
            },
            { mxid },
          ),
        );
      }

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

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLInputElement>) => {
      // On the unchecked -> checked transition, we handle that directly,
      // without the dialog. Else it falls through the default handler, which opens the dialog
      if (!event.currentTarget.checked) {
        event.preventDefault();
        mutate(event.currentTarget.checked);
      }
    },
    [mutate],
  );

  const onDialogAccept = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      mutate(true);
    },
    [mutate],
  );

  return (
    <Form.Root>
      <Form.InlineField
        name="admin"
        control={
          <Dialog.Root
            onOpenChange={setOpen}
            open={open}
            trigger={
              <Form.CheckboxControl
                checked={user.attributes.admin}
                onClick={onClick}
                disabled={isPending || open}
              />
            }
          >
            <Dialog.Title>
              <FormattedMessage
                id="pages.users.set_admin.title"
                defaultMessage="Make this user an admin?"
                description="The title of the modal asking for confirmation to give admin privileges to a user"
              />
            </Dialog.Title>
            <UserChip mxid={mxid} synapseRoot={synapseRoot} />
            <Dialog.Description asChild>
              <Alert
                type="critical"
                title={intl.formatMessage({
                  id: "pages.users.set_admin.alert.title",
                  description:
                    "In the modal to give admin privileges, the title of the alert",
                  defaultMessage: "User will have access to sensitive data",
                })}
              >
                <FormattedMessage
                  id="pages.users.set_admin.alert.description"
                  description="In the modal to give admin privileges, the description of the alert"
                  defaultMessage="The user will be able to view user data and make changes to user and room permissions."
                />
              </Alert>
            </Dialog.Description>
            <Button
              type="button"
              kind="primary"
              onClick={onDialogAccept}
              disabled={isPending}
            >
              {isPending && <InlineSpinner />}
              <FormattedMessage
                id="pages.users.set_admin.make_admin_button"
                defaultMessage="Make admin"
                description="The submit button text in the set admin privileges modal"
              />
            </Button>
            <Dialog.Close asChild>
              <Button type="button" kind="tertiary" disabled={isPending}>
                <FormattedMessage {...messages.actionCancel} />
              </Button>
            </Dialog.Close>
          </Dialog.Root>
        }
      >
        <Form.Label>
          <FormattedMessage
            id="pages.users.set_admin.label"
            defaultMessage="Admin"
            description="The label for the admin checkbox in the user panel"
          />
        </Form.Label>
      </Form.InlineField>
    </Form.Root>
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

interface UpstreamLinkListItemProps {
  serverName: string;
  mxid: string;
  id: Ulid;
  attributes: UpstreamOAuthLink;
}

function UpstreamLinkListItem({
  serverName,
  mxid,
  id,
  attributes,
}: UpstreamLinkListItemProps) {
  const queryClient = useQueryClient();
  const intl = useIntl();

  const { data: upstreamProvidersData } = useQuery(
    upstreamProvidersQuery(serverName),
  );
  const upstreamProvider = upstreamProvidersData?.find(
    (provider) => provider.id === attributes.provider_id,
  );

  const { mutate, isPending } = useMutation({
    mutationFn: (linkId: Ulid) =>
      deleteUpstreamOAuthLink(queryClient, serverName, linkId),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.delete_upstream_link.error",
          defaultMessage: "Failed to delete upstream link",
          description: "The error message for deleting an upstream link",
        }),
      );
    },
    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.delete_upstream_link.success",
          defaultMessage: "Upstream link deleted",
          description: "The success message for deleting an upstream link",
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: [
          "mas",
          "user-upstream-links",
          serverName,
          attributes.user_id,
        ],
      });
    },
  });

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      mutate(id);
    },
    [mutate, id],
  );

  return (
    <Data.Item>
      <Data.Title>Upstream account</Data.Title>
      {attributes.human_account_name && (
        <Data.Value>{attributes.human_account_name}</Data.Value>
      )}
      <Data.Value>ID: {attributes.subject}</Data.Value>
      {upstreamProvider ? (
        <Data.Value>{formatProviderName(upstreamProvider)}</Data.Value>
      ) : (
        <Data.Value>Provider ID: {attributes.provider_id}</Data.Value>
      )}
      <Dialog.Root
        trigger={
          <Button
            destructive
            kind="secondary"
            size="sm"
            className="self-stretch"
          >
            <FormattedMessage {...messages.actionRemove} />
          </Button>
        }
      >
        <Dialog.Title>
          <FormattedMessage
            id="pages.users.delete_upstream_link.title"
            defaultMessage="Remove link with upstream account?"
            description="The title of the modal asking for confirmation to delete an upstream account link"
          />
        </Dialog.Title>
        <Dialog.Description>
          <FormattedMessage
            id="pages.users.delete_upstream_link.description"
            defaultMessage="Are you sure you want to remove the link between this user ({mxid}) with this upstream account ({subject})?"
            description="The description of the modal asking for confirmation to delete an upstream link"
            values={{
              mxid,
              subject: attributes.subject,
            }}
          />
        </Dialog.Description>
        <Button kind="primary" destructive onClick={onClick}>
          {isPending && <InlineSpinner />}
          <FormattedMessage {...messages.actionRemove} />
        </Button>
        <Dialog.Close asChild>
          <Button kind="tertiary">
            <FormattedMessage {...messages.actionCancel} />
          </Button>
        </Dialog.Close>
      </Dialog.Root>
    </Data.Item>
  );
}

function formatProviderName(
  provider: SingleResourceForUpstreamOAuthProvider,
): string {
  const base =
    provider.attributes.human_name ?? provider.attributes.issuer ?? provider.id;
  if (provider.attributes.disabled_at) {
    return `${base} (disabled)`;
  }

  return base;
}

interface UpstreamLinksListProps {
  userId: string;
  mxid: string;
  serverName: string;
}
function UpstreamLinksList({
  userId,
  mxid,
  serverName,
}: UpstreamLinksListProps) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: upstreamLinksData } = useSuspenseQuery(
    userUpstreamLinksQuery(serverName, userId),
  );

  const { data: upstreamProvidersData } = useQuery(
    upstreamProvidersQuery(serverName),
  );

  // We show the add button either if the providers list is not available, or if
  // there are providers in that list
  const shouldShowAddButton =
    upstreamProvidersData === undefined || upstreamProvidersData.length > 0;

  // This value is set if and only if there is a single provider in the list
  let onlyProvider = upstreamProvidersData?.at(0);
  if (upstreamProvidersData?.length !== 1) {
    onlyProvider = undefined;
  }

  // TODO: handle error message from the server
  const { mutate, isPending } = useMutation({
    mutationFn: ({
      providerId,
      subject,
    }: {
      providerId: string;
      subject: string;
    }) =>
      addUpstreamOAuthLink(
        queryClient,
        serverName,
        userId,
        providerId,
        subject,
      ),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.add_upstream_link.error",
          defaultMessage: "Failed to add link upstream account",
          description: "The error message for adding an upstream link",
        }),
      );
    },
    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.add_upstream_link.success",
          defaultMessage: "Link to upstream account added",
          description: "The success message for adding an upstream link",
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: ["mas", "user-upstream-links", serverName, userId],
      });
      setOpen(false);
    },
  });

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const subject = data.get("subject") as string;
      const providerId = data.get("providerId") as string;
      mutate({ providerId, subject });
    },
    [mutate],
  );

  return (
    <>
      {upstreamLinksData.data.length > 0 && (
        <Data.Grid>
          {upstreamLinksData.data.map((link) => (
            <UpstreamLinkListItem
              key={link.id}
              mxid={mxid}
              serverName={serverName}
              {...link}
            />
          ))}
        </Data.Grid>
      )}

      {shouldShowAddButton && (
        <Dialog.Root
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button
              kind="secondary"
              size="sm"
              Icon={PlusIcon}
              className="self-stretch"
            >
              Add link to upstream account
            </Button>
          }
        >
          <Dialog.Title>Add link to upstream account</Dialog.Title>
          <Dialog.Description>
            Add a link to an upstream account to this user
          </Dialog.Description>
          <Form.Root onSubmit={onSubmit}>
            <Form.Field name="subject">
              <Form.Label>Subject</Form.Label>
              <Form.TextControl required type="text" />
              <Form.HelpMessage>
                The internal ID of the upstream account
              </Form.HelpMessage>
              <Form.ErrorMessage match="valueMissing">
                This field is required
              </Form.ErrorMessage>
            </Form.Field>

            {upstreamProvidersData && upstreamProvidersData.length > 0 ? (
              onlyProvider ? (
                <Form.Field name="readonlyProvider">
                  {/* If we have a single provider, display that as a read-only text field */}
                  <Form.Label>Provider</Form.Label>
                  <Form.TextControl
                    type="text"
                    readOnly
                    value={formatProviderName(onlyProvider)}
                  />
                  <input
                    type="hidden"
                    name="providerId"
                    value={onlyProvider.id}
                  />
                </Form.Field>
              ) : (
                upstreamProvidersData.map((provider) => (
                  <Form.InlineField
                    name="providerId"
                    key={provider.id}
                    control={<Form.RadioControl value={provider.id} />}
                  >
                    <Form.Label>{formatProviderName(provider)}</Form.Label>
                  </Form.InlineField>
                ))
              )
            ) : (
              <Form.Field name="providerId">
                {/* If we don't have the providers list, fallback to a text field */}
                <Form.Label>Provider ID</Form.Label>
                <Form.TextControl
                  required
                  type="text"
                  pattern="[0-7][0-9A-HJKMNP-TV-Z]{25}"
                />
                <Form.HelpMessage>
                  The upstream provider ID, as specified in the MAS
                  configuration
                </Form.HelpMessage>
                <Form.ErrorMessage match="valueMissing">
                  This field is required
                </Form.ErrorMessage>
                <Form.ErrorMessage match="patternMismatch">
                  Must be a valid ULID
                </Form.ErrorMessage>
              </Form.Field>
            )}

            <Form.Submit disabled={isPending}>
              {isPending && <InlineSpinner />}
              <FormattedMessage {...messages.actionAdd} />
            </Form.Submit>
          </Form.Root>

          <Dialog.Close asChild>
            <Button kind="tertiary">
              <FormattedMessage {...messages.actionCancel} />
            </Button>
          </Dialog.Close>
        </Dialog.Root>
      )}
    </>
  );
}

interface EmailListItemProps {
  serverName: string;
  mxid: string;
  id: Ulid;
  attributes: UserEmail;
}

function EmailListItem({
  serverName,
  mxid,
  id,
  attributes,
}: EmailListItemProps) {
  const queryClient = useQueryClient();
  const intl = useIntl();
  const { mutate, isPending } = useMutation({
    mutationFn: (userEmailId: Ulid) =>
      deleteUserEmail(queryClient, serverName, userEmailId),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.delete_email.error",
          defaultMessage: "Failed to delete email address",
          description: "The error message for deleting an email address",
        }),
      );
    },
    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.delete_email.success",
          defaultMessage: "Email address deleted",
          description: "The success message for deleting an email address",
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: ["mas", "user-emails", serverName, attributes.user_id],
      });
    },
  });

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      mutate(id);
    },
    [mutate, id],
  );

  return (
    <Data.Item>
      <Data.Title>
        <FormattedMessage {...messages.commonEmailAddress} />
      </Data.Title>
      <Data.Value>{attributes.email}</Data.Value>
      <Dialog.Root
        trigger={
          <Button
            destructive
            kind="secondary"
            size="sm"
            className="self-stretch"
          >
            <FormattedMessage {...messages.actionRemove} />
          </Button>
        }
      >
        <Dialog.Title>
          <FormattedMessage
            id="pages.users.delete_email.title"
            defaultMessage="Remove email address?"
            description="The title of the modal asking for confirmation to delete an email address"
          />
        </Dialog.Title>
        <Dialog.Description>
          <FormattedMessage
            id="pages.users.delete_email.description"
            defaultMessage="Are you sure you want to remove this email address ({email}) from this user ({mxid})?"
            description="The description of the modal asking for confirmation to delete an email address"
            values={{
              email: attributes.email,
              mxid,
            }}
          />
        </Dialog.Description>
        <Button kind="primary" destructive onClick={onClick}>
          {isPending && <InlineSpinner />}
          <FormattedMessage {...messages.actionRemove} />
        </Button>
        <Dialog.Close asChild>
          <Button kind="tertiary">
            <FormattedMessage {...messages.actionCancel} />
          </Button>
        </Dialog.Close>
      </Dialog.Root>
    </Data.Item>
  );
}

interface EmailsListProps {
  userId: string;
  mxid: string;
  serverName: string;
}
function EmailsList({ userId, mxid, serverName }: EmailsListProps) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: emailsData } = useSuspenseQuery(
    userEmailsQuery(serverName, userId),
  );
  // TODO: handle error message from the server
  const { mutate, isPending } = useMutation({
    mutationFn: (email: string) =>
      addUserEmail(queryClient, serverName, userId, email),
    onError: () => {
      toast.error(
        intl.formatMessage({
          id: "pages.users.add_email.error",
          defaultMessage: "Failed to add email address",
          description: "The error message for adding an email address",
        }),
      );
    },
    onSuccess: async (): Promise<void> => {
      toast.success(
        intl.formatMessage({
          id: "pages.users.add_email.success",
          defaultMessage: "Email address added",
          description: "The success message for adding an email address",
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: ["mas", "user-emails", serverName, userId],
      });
      setOpen(false);
    },
  });

  const onSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const email = data.get("email") as string;
      mutate(email);
    },
    [mutate],
  );

  return (
    <>
      {emailsData.data.length > 0 && (
        <Data.Grid>
          {emailsData.data.map((emailItem) => (
            <EmailListItem
              key={emailItem.id}
              mxid={mxid}
              serverName={serverName}
              {...emailItem}
            />
          ))}
        </Data.Grid>
      )}

      <Dialog.Root
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button
            kind="secondary"
            size="sm"
            Icon={PlusIcon}
            className="self-stretch"
          >
            <FormattedMessage
              id="pages.users.add_email.button"
              defaultMessage="Add email address"
              description="The label of the button for adding an email address to a user"
            />
          </Button>
        }
      >
        <Dialog.Title>
          <FormattedMessage
            id="pages.users.add_email.title"
            defaultMessage="Add email address"
            description="The title of the modal for adding an email address"
          />
        </Dialog.Title>
        <Dialog.Description>
          <FormattedMessage
            id="pages.users.add_email.description"
            defaultMessage="Add an email address to this user"
            description="The description of the modal for adding an email address"
          />
        </Dialog.Description>
        <Form.Root onSubmit={onSubmit}>
          <Form.Field name="email">
            <Form.Label>
              <FormattedMessage {...messages.commonEmailAddress} />
            </Form.Label>
            <Form.TextControl required type="email" />
            <Form.ErrorMessage match="valueMissing">
              <FormattedMessage
                id="pages.users.add_email.error.email_missing"
                defaultMessage="This field is required"
                description="Error message for missing email address in the modal for adding an email address"
              />
            </Form.ErrorMessage>
            <Form.ErrorMessage match="typeMismatch">
              <FormattedMessage
                id="pages.users.add_email.error.email_invalid"
                defaultMessage="Invalid email address"
                description="Error message for invalid email address in the modal for adding an email address"
              />
            </Form.ErrorMessage>
          </Form.Field>
          <Form.Submit disabled={isPending}>
            {isPending && <InlineSpinner />}
            <FormattedMessage {...messages.actionAdd} />
          </Form.Submit>
        </Form.Root>

        <Dialog.Close asChild>
          <Button kind="tertiary">
            <FormattedMessage {...messages.actionCancel} />
          </Button>
        </Dialog.Close>
      </Dialog.Root>
    </>
  );
}

const CloseSidebar: React.FC = () => {
  const intl = useIntl();
  const search = Route.useSearch();
  return (
    <div className="flex items-center justify-end">
      <Tooltip label={intl.formatMessage(messages.actionClose)}>
        <ButtonLink
          iconOnly
          to="/users"
          search={search}
          kind="tertiary"
          size="sm"
          Icon={CloseIcon}
        />
      </Tooltip>
    </div>
  );
};

function RouteComponent() {
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

  const { data: siteConfig } = useSuspenseQuery(
    siteConfigQuery(credentials.serverName),
  );

  const deactivated = user.attributes.deactivated_at !== null;
  const locked = user.attributes.locked_at !== null;

  return (
    <Navigation.Details>
      <CloseSidebar />

      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4">
          <UserAvatar synapseRoot={synapseRoot} userId={mxid} size="88px" />
          <div className="flex flex-col gap-2 items-center text-text-primary">
            <Text size="lg" weight="semibold">
              {mxid}
            </Text>
            {displayName && <Text size="md">{displayName}</Text>}
          </div>
          <AdminCheckbox
            mxid={mxid}
            user={user}
            synapseRoot={synapseRoot}
            serverName={credentials.serverName}
          />
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

          {siteConfig.password_login_enabled && !deactivated && (
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
            <Data.Title>Created at</Data.Title>
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
        </Data.Grid>

        <Separator />

        <div className="flex flex-col gap-4">
          <EmailsList
            mxid={mxid}
            userId={userId}
            serverName={credentials.serverName}
          />

          <UpstreamLinksList
            userId={userId}
            mxid={mxid}
            serverName={credentials.serverName}
          />
        </div>
      </div>
    </Navigation.Details>
  );
}
