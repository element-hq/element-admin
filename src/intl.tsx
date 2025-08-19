import { useSuspenseQuery } from "@tanstack/react-query";
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
const locales = import.meta.glob<string>("../translatons/compiled/*.json", {
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

  // Load the language data asynchronously
  // This will suspend during loading
  const result = useSuspenseQuery({
    queryKey: ["language", locale],
    queryFn: async (): Promise<Record<string, MessageFormatElement[]>> => {
      const url = getLocaleUrl(locale);
      if (!url) {
        throw new Error(`Could not find locale ${locale}`);
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not load locale ${locale}`);
      }

      return response.json();
    },
  });

  return (
    <ReactIntlProvider
      locale={locale}
      messages={result.data}
      defaultLocale={DEFAULT_LOCALE}
    >
      {children}
    </ReactIntlProvider>
  );
};
