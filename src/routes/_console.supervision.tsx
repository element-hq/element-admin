// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CopyIcon,
  PopOutIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Alert,
  Button,
  Form,
  InlineSpinner,
  Text,
  Tooltip,
} from "@vector-im/compound-web";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import {
  adminbotQuery,
  essVersionQuery,
  useEssVariant,
  type AdminbotResponse,
} from "@/api/ess";
import { wellKnownQuery } from "@/api/matrix";
import * as Card from "@/components/card";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import * as Marketing from "@/ui/marketing";
import { assertNever } from "@/utils/never";

const titleMessage = defineMessage({
  id: "pages.supervision.title",
  defaultMessage: "Supervision",
  description: "The title of the supervision page",
});

export const Route = createFileRoute("/_console/supervision")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  loader: async ({ context: { queryClient, credentials } }): Promise<void> => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    await Promise.all([
      // We use prefetchQuery and not ensureQueryData here to avoid failing the
      // load if the adminbot endpoint fails to fetch
      queryClient.prefetchQuery(adminbotQuery(synapseRoot)),
      queryClient.ensureQueryData(essVersionQuery(synapseRoot)),
    ]);
  },

  component: RouteComponent,
});

interface Config {
  instance: URL;
  hostname: string;
  userId: string;
  accessToken: string;
  deviceId: string;
}

const messageSchema = v.picklist(["loaded", "authenticated", "missing-config"]);

type Result = "ok" | "cant open" | "closed";

async function openSupervision({
  instance,
  hostname,
  userId,
  accessToken,
  deviceId,
}: Config): Promise<Result> {
  const controller = new AbortController();
  const loginWindow = globalThis.window.open(instance, "supervision-ui");
  if (loginWindow === null || loginWindow.closed) {
    return "cant open";
  }

  let resolve: (result: Result) => void, reject: (reason?: unknown) => void;
  const ready = new Promise<Result>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });

  // Regularly check if the window was closed
  const checkInterval = setInterval(() => {
    if (loginWindow.closed) {
      resolve("closed");
    }
  }, 100);

  // Cleanup the interval on abort
  controller.signal.addEventListener(
    "abort",
    () => clearInterval(checkInterval),
    { once: true },
  );

  globalThis.window.addEventListener(
    "message",
    (message: MessageEvent) => {
      if (message.origin !== instance.origin) {
        console.warn("Got message from unexpected origin", message);
        return;
      }

      if (message.source !== loginWindow) {
        console.warn("Got message from unexpected source", message);
        return;
      }

      const result = v.safeParse(messageSchema, message.data);
      if (!result.success) {
        reject(
          new Error("Got message with invalid schema", {
            cause: new v.ValiError(result.issues),
          }),
        );
        return;
      }
      const data = result.output;

      switch (data) {
        case "missing-config": {
          // This is a special case we shouldn't see outside of misconfiguration.
          // No need to localize this error message
          reject(
            new Error("The adminbot UI is reporting a missing configuration"),
          );

          // Close the window
          loginWindow.close();

          break;
        }

        case "loaded": {
          const payload = {
            hostname,
            userId,
            accessToken,
            deviceId,
          };

          // Send the config right away, then try sending the config in a loop.
          // Sometimes sending it too early doesn't work for some reason
          loginWindow.postMessage(payload, instance.origin);
          const configInterval = setInterval(() => {
            loginWindow.postMessage(payload, instance.origin);
          }, 500);

          controller.signal.addEventListener(
            "abort",
            () => clearInterval(configInterval),
            { once: true },
          );

          break;
        }

        case "authenticated": {
          resolve("ok");
          break;
        }

        default: {
          assertNever(data);
        }
      }
    },
    {
      signal: controller.signal,
    },
  );

  try {
    return await ready;
  } finally {
    // This will remove the listener on window
    controller.abort();
  }
}

interface LaunchAdminbotProps {
  instance: string;
  hostname: string;
  userId: string;
  accessToken: string;
  deviceId: string;
}

function LaunchAdminbot({
  instance,
  hostname,
  userId,
  accessToken,
  deviceId,
}: LaunchAdminbotProps) {
  const intl = useIntl();
  const { mutate, isPending, error, data } = useMutation({
    mutationFn: openSupervision,
  });

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>): void => {
      event.preventDefault();

      mutate({
        instance: new URL(instance),
        hostname,
        userId,
        accessToken,
        deviceId,
      });
    },
    [mutate, instance, hostname, userId, accessToken, deviceId],
  );

  return (
    <>
      {data === "cant open" && (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: "pages.supervision.errors.cant_open.title",
            defaultMessage:
              "Failed to open the supervision interface in a new window",
            description:
              "The title of the error message when the supervision interface can't be opened",
          })}
        >
          <FormattedMessage
            id="pages.supervision.errors.cant_open.description"
            defaultMessage="Your browser is blocking the opening of pop-up windows. Please make sure you allow pop-ups from this site."
            description="The description of the error message when the supervision interface can't be opened in a new window"
          />
        </Alert>
      )}

      {data === "closed" && (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: "pages.supervision.errors.closed.title",
            defaultMessage: "The supervision interface was closed too quickly",
            description:
              "The title of the error message when the supervision interface was closed",
          })}
        >
          <FormattedMessage
            id="pages.supervision.errors.closed.description"
            defaultMessage="Failed to sign in the supervision interface, as it closed before it could finish signing in"
            description="The description of the error message when the supervision interface was closed"
          />
        </Alert>
      )}

      {!!error && (
        <Alert
          type="critical"
          title={intl.formatMessage({
            id: "pages.supervision.errors.generic.title",
            defaultMessage:
              "An unexpected error occurred whilst opening the supervision interface",
            description:
              "The title of the error message when the supervision interface can't be opened",
          })}
        >
          {String(error)}
        </Alert>
      )}

      <Button
        className="self-start"
        onClick={onClick}
        disabled={isPending}
        kind="primary"
        size="md"
        Icon={isPending ? undefined : PopOutIcon}
      >
        {isPending && <InlineSpinner />}
        <FormattedMessage {...messages.actionSignIn} />
      </Button>
    </>
  );
}

interface AdminbotContentProps {
  config: AdminbotResponse;
  synapseRoot: string;
}

function AdminbotContent({ config, synapseRoot }: AdminbotContentProps) {
  const intl = useIntl();
  return (
    <>
      <div className="flex flex-col gap-6 max-w-[60ch]">
        <Text size="md" className="text-pretty">
          <FormattedMessage
            id="pages.supervision.description"
            defaultMessage="Sign in as <b>{mxid}</b> to perform administrative actions in any room."
            description="The description of the supervision page"
            values={{
              mxid: config.mxid,
              // oxlint-disable-next-line react/no-unstable-nested-components
              b: (chunks) => <b>{...chunks}</b>,
            }}
          />
        </Text>

        {config.ui_address ? (
          <LaunchAdminbot
            instance={config.ui_address}
            hostname={synapseRoot}
            userId={config.mxid}
            accessToken={config.access_token}
            deviceId={config.device_id}
          />
        ) : (
          <Alert
            type="critical"
            title={intl.formatMessage({
              id: "pages.supervision.missing_ui_address.title",
              description:
                "When adminbot is enabled, but the Element Web is not deployed with ESS, we show an alert, as the UI feature relies on it. This is the title of said alert.",
              defaultMessage:
                "The supervision interface requires Element Web to be enabled",
            })}
          >
            <FormattedMessage
              id="pages.supervision.missing_ui_address.description"
              description="When adminbot is enabled, but the Element Web is not deployed with ESS, we show an alert, as the UI feature relies on it. This is the description of said alert."
              defaultMessage="Supervision is enabled in your deployment, but not Element Web, which is required for the supervision interface to work."
            />
          </Alert>
        )}

        {config.secure_passphrase && (
          <SecurePassphrase value={config.secure_passphrase} />
        )}
      </div>
    </>
  );
}

interface SecurePassphraseProps {
  value: string;
}

function SecurePassphrase({ value }: SecurePassphraseProps) {
  const intl = useIntl();
  const onCopyClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      try {
        await navigator.clipboard.writeText(value);
        toast.success(
          intl.formatMessage({
            id: "pages.supervision.recovery_key.copied",
            description:
              "On the supervision page, message displayed when the recovery key is copied to the clipboard",
            defaultMessage: "Recovery key copied",
          }),
        );
      } catch (error) {
        console.error("Could not copy recovery key to the clipboard", error);
        toast.error(
          intl.formatMessage({
            id: "pages.supervision.recovery_key.copy_failed",
            description:
              "On the supervision page, message displayed when the recovery key could not be copied to the clipboard",
            defaultMessage: "Could not copy recovery key",
          }),
        );
      }
    },
    [value, intl],
  );

  return (
    <Form.Root
      onSubmit={(event) => event.preventDefault()}
      className="max-w-[40ch]"
    >
      <Form.Field name="passphrase">
        <Form.Label>
          <FormattedMessage
            id="pages.supervision.recovery_key.label"
            description="On the supervision page, label for the recovery key readonly input field"
            defaultMessage="Recovery key"
          />
        </Form.Label>
        <div className="flex items-center gap-3">
          <Form.TextControl
            type="password"
            className="flex-1"
            readOnly
            value={value}
          />
          <Tooltip label={intl.formatMessage(messages.actionCopy)}>
            <Button
              iconOnly
              Icon={CopyIcon}
              onClick={onCopyClick}
              kind="secondary"
              size="md"
            />
          </Tooltip>
        </div>
        <Form.HelpMessage className="text-pretty">
          <FormattedMessage
            id="pages.supervision.recovery_key.help"
            description="On the supervision page, help text for the recovery key readonly input field"
            defaultMessage="This is the recovery key used to enable reading encrypted messages."
          />
        </Form.HelpMessage>
      </Form.Field>
    </Form.Root>
  );
}

interface AdminbotDisabledProps {
  isPro?: boolean;
}

function AdminbotDisabled({ isPro }: AdminbotDisabledProps) {
  const intl = useIntl();
  return (
    <>
      {isPro ? (
        <Alert
          type="info"
          className="max-w-[80ch]"
          title={intl.formatMessage({
            id: "pages.supervision.disabled_alert.title",
            description:
              "When the feature is disabled on an ESS Pro deployment, this is the title of the alert message telling admins to configure it",
            defaultMessage: "Supervision is currently disabled",
          })}
        >
          <FormattedMessage
            id="pages.supervision.disabled_alert.description"
            description="When the feature is disabled on an ESS Pro deployment, this is the description of the alert message telling admins to configure it"
            defaultMessage="This feature is part of your subscription. You can ask an administrator to enable it."
          />
        </Alert>
      ) : (
        <Alert
          type="info"
          className="max-w-[80ch]"
          title={intl.formatMessage({
            id: "pages.supervision.unavailable_alert.title",
            description:
              "Title of the alert explaining that the supervision feature is only available in ESS Pro",
            defaultMessage: "Supervision is a feature available in ESS Pro",
          })}
        >
          <FormattedMessage
            id="pages.supervision.unavailable_alert.description"
            description="Description of the alert explaining that the supervision feature is only available in ESS Pro"
            defaultMessage="This feature is not available in ESS Community. Upgrade to ESS Pro to enable it."
          />
        </Alert>
      )}

      <Card.Stack>
        <Marketing.SupervisionCard proBadge={!isPro} />
        {!isPro && <Marketing.AlsoAvailableInPro />}
      </Card.Stack>
    </>
  );
}

const MaybeAdminbotContent = ({ synapseRoot }: { synapseRoot: string }) => {
  const { data: adminbot } = useSuspenseQuery(adminbotQuery(synapseRoot));
  return adminbot ? (
    <AdminbotContent config={adminbot} synapseRoot={synapseRoot} />
  ) : (
    <AdminbotDisabled isPro />
  );
};

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const variant = useEssVariant(synapseRoot);

  return (
    <Navigation.Content>
      <Navigation.Main>
        <Page.Header>
          <Page.Title>
            <FormattedMessage {...titleMessage} />
          </Page.Title>
        </Page.Header>

        {variant === "pro" ? (
          <MaybeAdminbotContent synapseRoot={synapseRoot} />
        ) : (
          <AdminbotDisabled />
        )}
      </Navigation.Main>
      <AppFooter />
    </Navigation.Content>
  );
}
