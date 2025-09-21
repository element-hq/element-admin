import { createRoot, hydrateRoot } from "react-dom/client";

import { App } from "@/app";
import { router } from "@/router";

const rootElement = document.querySelector("#app");
if (!rootElement) {
  throw new Error("Root element not found");
}

// If there is something in the root element, hydrate, else fallback to
// creating a new root
if (rootElement.innerHTML) {
  // eslint-disable-next-line unicorn/prefer-top-level-await -- Top-level await doesn't work in this case
  (async () => {
    // This will trigger the loading everything in the router.
    // We do this before trying to render/hydrate, to avoid flickering to a blank
    // screen (which TanStack Router will do if it is loading the matches)
    await router.load();

    hydrateRoot(rootElement, <App />, {
      onRecoverableError: (error) => {
        // React doesn't like that we use `renderToString` to render a
        // suspense boundary fallback. This is very much intentional, so we
        // can safely ignore this
        if (error instanceof Error && error.message.includes("#419")) {
          return;
        }

        console.error(error);
      },
    });
  })();
} else {
  // This is the fallback during development, when we don't have a pre-rendered
  // spinner. We want to start rendering as soon as possible so that devtools
  // get rendered; we don't care about pre-loading the router
  const root = createRoot(rootElement);

  root.render(<App />);
}
