import { match } from "@formatjs/intl-localematcher";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect, useSyncExternalStore } from "react";
import {
  IntlProvider as ReactIntlProvider,
  useIntl,
  type MessageFormatElement,
} from "react-intl";

import { router } from "@/router";
import { useLocaleStore } from "@/stores/locale";

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

// eslint-disable-next-line react-refresh/only-export-components -- We should probably move that?
export const AVAILABLE_LOCALES = Object.keys(locales)
  .map((url) => {
    const lang = url.match(/\/([^/]+)\.json$/)?.[1];
    if (!lang) {
      throw new Error(`Could not parse locale URL ${url}`);
    }
    return lang;
  })
  .sort();

/**
 * Figure out the best language out of the available ones
 *
 * @returns The best supported language
 */
const getBestLocale = (): string =>
  match(navigator.languages, AVAILABLE_LOCALES, DEFAULT_LOCALE);

/**
 * A hook that returns the best supported language, synced with the browser's
 * language change events
 *
 * @returns The best supported language
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useBestLocale = (): string =>
  useSyncExternalStore((callback) => {
    globalThis.addEventListener("languagechange", callback);
    return () => globalThis.removeEventListener("languagechange", callback);
  }, getBestLocale);

export const IntlProvider = ({ children }: { children: React.ReactNode }) => {
  const bestLocale = useBestLocale();
  const selectedLocale = useLocaleStore((state) => state.selectedLocale);
  const locale =
    selectedLocale && AVAILABLE_LOCALES.includes(selectedLocale)
      ? selectedLocale
      : bestLocale;

  useEffect(() => {
    if (document && document.documentElement) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Load the language data. This will suspend during loading
  const { data: messages } = useSuspenseQuery({
    queryKey: ["language", locale],
    queryFn: async (): Promise<LocaleData> => {
      const loader = getLocaleLoader(locale);
      if (!loader) {
        throw new Error(`Could not find locale loader for ${locale}`);
      }

      return await loader();
    },
    staleTime: Infinity,
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
