import { shouldPolyfill as shouldPolyfillIntlGetCanonicalLocales } from "@formatjs/intl-getcanonicallocales/should-polyfill";
import { shouldPolyfill as shouldPolyfillIntlLocale } from "@formatjs/intl-locale/should-polyfill";
import { shouldPolyfill as shouldPolyfillIntlNumberFormat } from "@formatjs/intl-numberformat/should-polyfill";
import { shouldPolyfill as shouldPolyfillIntlPluralRules } from "@formatjs/intl-pluralrules/should-polyfill";
import { shouldPolyfill as shouldPolyfillIntlRelativeTimeFormat } from "@formatjs/intl-relativetimeformat/should-polyfill";
import { shouldPolyfill as shouldPolyfillIntlSegmenter } from "@formatjs/intl-segmenter/should-polyfill";
import { useSuspenseQueries } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useSyncExternalStore } from "react";
import {
  IntlProvider as ReactIntlProvider,
  useIntl,
  type MessageFormatElement,
} from "react-intl";

import { router } from "@/router";

import type messages from "../translations/extracted/en.json";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace FormatjsIntl {
    interface Message {
      ids: keyof typeof messages;
    }
  }
}

type LocaleData = Record<keyof typeof messages, MessageFormatElement[]>;

// This generates a map of locale names a function which loads them
// {
//   "./en.json": () => import("../whatever/assets/root/en-aabbcc.json"),
//   ...
// }
const locales = import.meta.glob<LocaleData>("./*.json", {
  base: "../translations/compiled/",
  import: "default",
});

const getLocaleLoader = (
  name: string,
): (() => Promise<LocaleData>) | undefined => locales[`./${name}.json`];

const DEFAULT_LOCALE = "en";

const supportedLngs = Object.keys(locales).map((url) => {
  const lang = url.match(/\/([^/]+)\.json$/)?.[1];
  if (!lang) {
    throw new Error(`Could not parse locale URL ${url}`);
  }
  return lang;
});

/**
 * Figure out the best language out of the available ones
 *
 * @returns The best supported language
 */
const getBestLocale = (): string => {
  for (const preference of navigator.languages) {
    try {
      // Use Intl.Collator to resolve the locale
      const resolved = new Intl.Collator(preference).resolvedOptions().locale;

      // Check if we have an exact match
      const exact = supportedLngs.find(
        (locale) => locale.toLowerCase() === resolved.toLowerCase(),
      );
      if (exact) return exact;

      // Check for language match
      const resolvedLang = resolved.split("-")[0];
      const langMatch = supportedLngs.find(
        (locale) => locale.split("-")[0] === resolvedLang,
      );
      if (langMatch) return langMatch;
    } catch {
      continue;
    }
  }

  return DEFAULT_LOCALE; // Default locale
};

/**
 * Loads the Intl polyfills for the given locale
 *
 * @param locale The locale to load
 */
const loadIntlPolyfillsForLocale = async (locale: string): Promise<void> => {
  // Holds the dynamic imports of polyfills
  const promises: Promise<unknown>[] = [];
  // Holds the extra data to load once the polyfills are loaded
  const dataLoaders: (() => Promise<unknown>)[] = [];

  if (shouldPolyfillIntlSegmenter()) {
    promises.push(import("@formatjs/intl-segmenter/polyfill-force"));
  }

  if (shouldPolyfillIntlGetCanonicalLocales()) {
    promises.push(import("@formatjs/intl-getcanonicallocales/polyfill-force"));
  }

  if (shouldPolyfillIntlLocale()) {
    promises.push(import("@formatjs/intl-locale/polyfill-force"));
  }

  if (shouldPolyfillIntlPluralRules(locale)) {
    promises.push(import("@formatjs/intl-pluralrules/polyfill-force"));
    // Initially, I tried using a dynamic variable import, but it has two important limitations:
    //   1. It needs a relative path, leaving an ugly `../node_modules` prefix
    //   2. It would emit chunks for every single locale, which slows down the
    //      build quite a bit, even if we don't use them
    // Maybe we should code-gen this part, or have some kind of vite plugin to handle this?
    //
    // FIXME: Make sure this is in sync with the current list of supported locales
    switch (locale) {
      case "en": {
        dataLoaders.push(
          () => import("@formatjs/intl-pluralrules/locale-data/en"),
        );
        break;
      }
      case "fr": {
        dataLoaders.push(
          () => import("@formatjs/intl-pluralrules/locale-data/fr"),
        );
        break;
      }
      case "de": {
        dataLoaders.push(
          () => import("@formatjs/intl-pluralrules/locale-data/de"),
        );
        break;
      }
      default: {
        throw new Error(`Unsupported locale ${locale}`);
      }
    }
  }

  if (shouldPolyfillIntlNumberFormat(locale)) {
    promises.push(import("@formatjs/intl-numberformat/polyfill-force"));
    switch (locale) {
      case "en": {
        dataLoaders.push(
          () => import("@formatjs/intl-numberformat/locale-data/en"),
        );
        break;
      }
      case "fr": {
        dataLoaders.push(
          () => import("@formatjs/intl-numberformat/locale-data/fr"),
        );
        break;
      }
      case "de": {
        dataLoaders.push(
          () => import("@formatjs/intl-numberformat/locale-data/de"),
        );
        break;
      }
      default: {
        throw new Error(`Unsupported locale ${locale}`);
      }
    }
  }

  if (shouldPolyfillIntlRelativeTimeFormat(locale)) {
    promises.push(import("@formatjs/intl-relativetimeformat/polyfill-force"));
    switch (locale) {
      case "en": {
        dataLoaders.push(
          () => import("@formatjs/intl-relativetimeformat/locale-data/en"),
        );
        break;
      }
      case "fr": {
        dataLoaders.push(
          () => import("@formatjs/intl-relativetimeformat/locale-data/fr"),
        );
        break;
      }
      case "de": {
        dataLoaders.push(
          () => import("@formatjs/intl-relativetimeformat/locale-data/de"),
        );
        break;
      }
      default: {
        throw new Error(`Unsupported locale ${locale}`);
      }
    }
  }

  // First, make sure all the polyfills are loaded
  await Promise.all(promises);
  // Then load the associated locale datas
  await Promise.all(dataLoaders.map((loader) => loader()));
};

/**
 * A hook that returns the best supported language, synced with the browser's
 * language change events
 *
 * @returns The best supported language
 */
const useBestLocale = (): string => {
  return useSyncExternalStore((callback) => {
    globalThis.addEventListener("languagechange", callback);
    return () => globalThis.removeEventListener("languagechange", callback);
  }, getBestLocale);
};

export const IntlProvider = ({ children }: { children: React.ReactNode }) => {
  const locale = useBestLocale();

  useEffect(() => {
    if (document && document.documentElement) {
      document.documentElement.lang = locale;
    }
  });

  // Load the language data and the Intl polyfills asynchronously in parallel
  // This will suspend during loading
  const [{ data: messages }, _] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["language", locale],
        queryFn: async (): Promise<LocaleData> => {
          const loader = getLocaleLoader(locale);
          if (!loader) {
            throw new Error(`Could not find locale loader for ${locale}`);
          }

          return await loader();
        },
      },
      {
        queryKey: ["intl-polyfills", locale],
        queryFn: async (): Promise<null> => {
          await loadIntlPolyfillsForLocale(locale);
          return null;
        },
      },
    ],
  });

  return (
    <ReactIntlProvider
      locale={locale}
      messages={messages}
      defaultLocale={DEFAULT_LOCALE}
    >
      {children}
    </ReactIntlProvider>
  );
};

export const RouterWithIntl = () => {
  const intl = useIntl();
  return <RouterProvider router={router} context={{ intl }} />;
};
