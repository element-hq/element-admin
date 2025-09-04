import {
  useMutation,
  useQueryClient,
  useQueryErrorResetBoundary,
} from "@tanstack/react-query";
import {
  useCanGoBack,
  useNavigate,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ErrorIcon,
  SignOutIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button, InlineSpinner, Text } from "@vector-im/compound-web";
import { useCallback } from "react";
import { FormattedMessage } from "react-intl";

import { authMetadataQuery, revokeToken } from "@/api/auth";
import { wellKnownQuery } from "@/api/matrix";
import { ButtonLink } from "@/components/link";
import * as messages from "@/messages";
import { useAuthStore } from "@/stores/auth";

import styles from "./errors.module.css";

function RenderError({ error }: { error: unknown }) {
  if (error instanceof Error) {
    return (
      <>
        <Text title={error.stack}>
          <FormattedMessage
            id="pages.generic_error.technical_details.item"
            description="Technical details for the error, showing the error name and message"
            defaultMessage="{name}: {message}"
            values={{ name: error.name, message: error.message }}
          />
        </Text>
        {error.cause && <RenderError error={error.cause} />}
      </>
    );
  }

  if (typeof error === "object") {
    try {
      const stringified = JSON.stringify(error);
      return <Text>{stringified}</Text>;
    } catch (error) {
      console.error("Failed to stringify error", error);
    }
  }

  return <Text>{String(error)}</Text>;
}

function GenericError({ error, reset }: ErrorComponentProps) {
  const queryReset = useQueryErrorResetBoundary();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { credentials, clear } = useAuthStore();
  const loggedIn = !!credentials;

  const { mutate: signOut, isPending: isSigningOut } = useMutation({
    mutationFn: async () => {
      if (!credentials) {
        return;
      }

      const wellKnown = await queryClient.ensureQueryData(
        wellKnownQuery(credentials.serverName),
      );
      const synapseRoot = wellKnown["m.homeserver"].base_url;

      const { revocation_endpoint } = await queryClient.ensureQueryData(
        authMetadataQuery(synapseRoot),
      );

      await revokeToken(
        revocation_endpoint,
        credentials.accessToken,
        credentials.clientId,
      );
    },

    // Retry a few times before actually clearing the storage
    retry: 3,

    onSettled: () => {
      clear();
      navigate({ to: "/", reloadDocument: true });
    },
  });

  const onSignOutClick = useCallback(() => {
    queryReset.reset();
    signOut();
  }, [signOut, queryReset]);

  const goBack = useCallback(() => {
    queryReset.reset();
    router.history.back();
  }, [router, queryReset]);

  const onResetClick = useCallback(() => {
    queryReset.reset();
    reset();
    router.invalidate();
  }, [reset, queryReset, router]);

  return (
    <section className={styles["error-page"]}>
      <header className={styles["page-heading"]}>
        <div className={styles["icon"]}>
          <ErrorIcon />
        </div>

        <div className={styles["header"]}>
          <h1 className={styles["title"]}>
            <FormattedMessage
              id="pages.generic_error.title"
              defaultMessage="An unexpected error occurred"
              description="Title of the generic error page"
            />
          </h1>
          <p className={styles["text"]}>
            <FormattedMessage
              id="pages.generic_error.text"
              defaultMessage="This may be the result of a bug or failing to reach the homeserver. You can retry loading the page, go back to the previous page, or reset everything and go back to the homepage."
              description="Text of the generic error page"
            />
          </p>
        </div>
      </header>

      <section className={styles["technical-details"]}>
        <RenderError error={error} />
      </section>

      <Button kind="primary" onClick={onResetClick}>
        <FormattedMessage {...messages.actionRetry} />
      </Button>
      {loggedIn && (
        <Button
          disabled={isSigningOut}
          kind="secondary"
          destructive
          onClick={onSignOutClick}
          Icon={isSigningOut ? undefined : SignOutIcon}
        >
          {isSigningOut && <InlineSpinner />}
          <FormattedMessage
            id="pages.generic_error.sign_out_and_reload"
            defaultMessage="Sign out and reload"
            description="When an unxpected error happen, one option is to try to sign out the account and reload the page"
          />
        </Button>
      )}
      {canGoBack ? (
        <Button kind="secondary" onClick={goBack} Icon={ArrowLeftIcon}>
          <FormattedMessage {...messages.actionGoBack} />
        </Button>
      ) : (
        <ButtonLink kind="secondary" to="/" Icon={ArrowLeftIcon}>
          <FormattedMessage
            id="pages.generic_error.go_home"
            defaultMessage="Go home"
            description="When an unxpected error happen, one option is to go back to the homepage"
          />
        </ButtonLink>
      )}
    </section>
  );
}

export { GenericError };
