import { createRoot, hydrateRoot } from "react-dom/client";

import { App } from "@/app";
import { loadIntl } from "@/intl";
import { router } from "@/router";

// eslint-disable-next-line unicorn/prefer-top-level-await -- Top-level await doesn't work in this case
(async () => {
  const rootElement = document.querySelector("#app");
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  // Now we load the locales and inject them in the router
  router.update({
    ...router.options,
    context: {
      ...router.options.context,
      intl: await loadIntl(),
    },
  });

  // This will trigger the loading everything in the router.
  // We do this before trying to render/hydrate, to avoid flickering to a blank
  // screen (which TanStack Router will do if it is loading the matches)
  await router.load();

  // Remove the existing <title> tag, as this is managed by Tanstack Router now
  const title = document.querySelector("title");
  if (title) {
    title.remove();
  }

  // If there is something in the root element, hydrate, else fallback to
  // creating a new root
  if (rootElement.innerHTML) {
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
  } else {
    const root = createRoot(rootElement);

    root.render(<App />);
  }
})();
