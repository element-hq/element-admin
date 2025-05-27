import { createFileRoute } from "@tanstack/react-router";
import { H1 } from "@vector-im/compound-web";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <div className="text-center">
      <H1>Hello</H1>
    </div>
  );
}
