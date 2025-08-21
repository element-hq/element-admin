import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Form, Submit } from "@vector-im/compound-web";
import { type FormEvent, useCallback, useTransition } from "react";
import { FormattedMessage } from "react-intl";

export const Route = createFileRoute("/_auth/login/")({
  loader: ({ context: { intl } }) => ({
    title: intl.formatMessage({
      id: "pages.login.title",
      description: "Title for the login page",
      defaultMessage: "Login",
    }),
  }),
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.title }] : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const [isPending, startTransition] = useTransition();
  const navigate = useNavigate();
  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const serverName = formData.get("serverName") as string;
      startTransition(() =>
        navigate({ to: "/login/$serverName", params: { serverName } }),
      );
    },
    [navigate],
  );

  return (
    <Form.Root onSubmit={onSubmit}>
      <Form.Field name="serverName">
        <Form.Label>
          <FormattedMessage
            id="pages.login.server_name"
            description="Label for the server name field"
            defaultMessage="Server name"
          />
        </Form.Label>
        <Form.TextControl
          disabled={isPending}
          type="text"
          defaultValue="matrix.org"
        />
      </Form.Field>

      <Submit disabled={isPending}>Discover</Submit>
    </Form.Root>
  );
}
