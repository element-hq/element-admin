import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { shouldPolyfill as shouldPolyfillIntlRelativeTimeFormat } from "@formatjs/intl-relativetimeformat/should-polyfill";
import { shouldPolyfill as shouldPolyfillIntlPluralRules } from "@formatjs/intl-pluralrules/should-polyfill";

import { useSyncExternalStore } from "react";
import {
  IntlProvider as ReactIntlProvider,
  type MessageFormatElement,
} from "react-intl";

import type messages from "../translations/extracted/en.json";
declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: keyof typeof messages;
    }
  }
}

// This generates a map of locale names to their URL (based on import.meta.url), which looks like this:
// {
//   "../translations/compiled/en.json": "../whatever/assets/root/en-aabbcc.json",
//   ...
// }
const locales = import.meta.glob<string>("../translations/compiled/*.json", {
  query: "?url",
  import: "default",
  eager: true,
});

const getLocaleUrl = (name: string): string | undefined =>
  locales[`../translations/compiled/${name}.json`];

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
  if (shouldPolyfillIntlRelativeTimeFormat(locale)) {
    await import("@formatjs/intl-relativetimeformat/polyfill-force");
    // Initially, I tried using a dynamic variable import, but it has two important limitations:
    //   1. It needs a relative path, leaving an ugly `../node_modules` prefix
    //   2. It would emit chunks for every single locale, which slows down the
    //      build quite a bit, even if we don't use them
    // Maybe we should code-gen this part, or have some kind of vite plugin to handle this?
    //
    // FIXME: Make sure this is in sync with the current list of supported locales
    switch (locale) {
      case "en":
        await import("@formatjs/intl-relativetimeformat/locale-data/en");
        break;
      case "fr":
        await import("@formatjs/intl-relativetimeformat/locale-data/fr");
        break;
      default:
        throw new Error(`Unsupported locale ${locale}`);
    }
  }

  if (shouldPolyfillIntlPluralRules(locale)) {
    await import("@formatjs/intl-pluralrules/polyfill-force");
    switch (locale) {
      case "en":
        await import("@formatjs/intl-pluralrules/locale-data/en");
        break;
      case "fr":
        await import("@formatjs/intl-pluralrules/locale-data/fr");
        break;
      default:
        throw new Error(`Unsupported locale ${locale}`);
    }
  }
};

/**
 * A hook that returns the best supported language, synced with the browser's
 * language change events
 *
 * @returns The best supported language
 */
const useBestLocale = (): string => {
  return useSyncExternalStore((callback) => {
    window.addEventListener("languagechange", callback);
    return () => window.removeEventListener("languagechange", callback);
  }, getBestLocale);
};

export const IntlProvider = ({ children }: { children: React.ReactNode }) => {
  const locale = useBestLocale();

  // Load the language data and the Intl polyfills asynchronously in parallel
  // This will suspend during loading
  const [{ data: messages }, _] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["language", locale],
        queryFn: async (): Promise<Record<string, MessageFormatElement[]>> => {
          const url = getLocaleUrl(locale);
          if (!url) {
            throw new Error(`Could not find locale ${locale}`);
          }

          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Could not load locale ${locale} at ${url}`);
          }

          return response.json();
        },
      },
      {
        queryKey: ["intl-polyfills", locale],
        queryFn: async (): Promise<void> => {
          await loadIntlPolyfillsForLocale(locale);
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
