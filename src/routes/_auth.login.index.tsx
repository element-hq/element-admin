import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Form, Submit } from "@vector-im/compound-web";
import { type FormEvent, useCallback, useTransition } from "react";

export const Route = createFileRoute("/_auth/login/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [isPending, startTransition] = useTransition();
  const navigate = useNavigate();
  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
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
        <Form.Label>Server Name</Form.Label>
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
