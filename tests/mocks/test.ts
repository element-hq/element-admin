// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { defineNetworkFixture, type NetworkFixture } from "@msw/playwright";
import { test as base } from "@playwright/test";
import { http, passthrough } from "msw";

import { type DeploymentName, deployments } from "./handlers";

interface Fixtures {
  /**
   * The handler deployment for this test. An option fixture, so a whole spec or
   * describe block can swap it: `test.use({ deployment: "plainMas" })`. It is a
   * name rather than a handler array; see `deployments` in `./handlers` for why.
   */
  deployment: DeploymentName;

  /**
   * MSW, bound to the browser context via `context.route()`. Auto-enabled, so
   * tests only touch it to override a handler: `network.use(...)` prepends, so
   * a narrow override wins over the deployment.
   */
  network: NetworkFixture;
}

export const test = base.extend<Fixtures>({
  deployment: ["essPro", { option: true }],

  network: [
    async ({ context, deployment, baseURL }, use) => {
      // The app's own document has to pass through to the static server. MSW's
      // `isCommonAssetRequest` skips `.html`/`.js`/`.css`, but the SPA document
      // is requested as `/` or `/users`, with no extension, so it is not
      // skipped and strict mode below would fail the test. `baseURL` may or may
      // not end in a slash, so the pattern goes through `URL` rather than
      // concatenation.
      const appDocuments = baseURL && new URL("*", baseURL).toString();

      const network = defineNetworkFixture({
        context,
        handlers: [
          ...(appDocuments
            ? [http.get(appDocuments, () => passthrough())]
            : []),
          ...deployments[deployment](),
        ],
        // Strict: an unhandled request fails the test naming the URL. Without
        // it, a forgotten endpoint hits the real internet and surfaces as an
        // opaque `ERR_NAME_NOT_RESOLVED` behind a generic error screen.
        onUnhandledRequest(request, print) {
          // URLs the page minted for itself are the exception. The header
          // avatar arrives as a `Blob` and `useImageBlob` turns it into an
          // object URL, so the `<img>` loads `blob:http://…/<uuid>`. WebKit
          // routes those through `context.route()` and Chromium does not, so
          // this only affects the tablet and mobile projects, whose `iPad` and
          // `iPhone 15` descriptors default to WebKit. No handler can match a
          // page-minted URL, so failing on one would make those projects
          // unusable.
          const { protocol } = new URL(request.url);
          if (protocol === "blob:" || protocol === "data:") return;
          print.error();
        },
      });

      await network.enable();
      await use(network);
      await network.disable();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
