// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { Composite, CompositeItem } from "@floating-ui/react";
import { PublicIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button, Tooltip } from "@vector-im/compound-web";
import { forwardRef, useCallback, useMemo, useTransition } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import * as Dialog from "@/components/dialog";
import { AVAILABLE_LOCALES, useBestLocale } from "@/intl";
import { useLocaleStore } from "@/stores/locale";

import styles from "./language-switcher.module.css";

const LanguageSwitcherButton = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button">
>(function LanguageSwitcherButton(props, ref) {
  const intl = useIntl();
  return (
    <Tooltip
      placement="top"
      label={intl.formatMessage({
        id: "ui.language_switcher.button_label",
        defaultMessage: "Language settings",
        description: "Aria label for the language switcher button",
      })}
    >
      <Button
        {...props}
        ref={ref}
        as="button"
        type="button"
        kind="tertiary"
        size="md"
        Icon={PublicIcon}
        iconOnly
      />
    </Tooltip>
  );
});

interface LanguageNameProps {
  locale: string;
}
const LanguageName: React.FC<LanguageNameProps> = ({
  locale,
}: LanguageNameProps) => {
  const displayNameFormatter = useMemo(
    () =>
      new Intl.DisplayNames([locale], {
        type: "language",
      }),
    [locale],
  );

  return displayNameFormatter.of(locale);
};

const CHOICES = [null, ...AVAILABLE_LOCALES];

export const LanguageSwitcher: React.FC = () => {
  const intl = useIntl();
  const [pending, startTransition] = useTransition();
  const { selectedLocale, setLocale, clearLocale } = useLocaleStore();
  const bestLocale = useBestLocale();

  const selectItem = useCallback(
    (index: number) => {
      const locale = CHOICES[index];
      if (locale === selectedLocale) return;
      startTransition(() => {
        if (locale) setLocale(locale);
        else clearLocale();
      });
    },
    [setLocale, clearLocale, selectedLocale],
  );

  const activeIndex = useMemo(() => {
    const index = CHOICES.indexOf(selectedLocale);
    return index === -1 ? 0 : index;
  }, [selectedLocale]);

  return (
    <Dialog.Root trigger={<LanguageSwitcherButton />}>
      <Dialog.Title>
        <FormattedMessage
          id="ui.language_switcher.title"
          defaultMessage="Language settings"
          description="Title of the language switcher modal"
        />
      </Dialog.Title>

      <Dialog.Description>
        <FormattedMessage
          id="ui.language_switcher.description"
          defaultMessage="Choose your preferred language for the interface."
          description="Description text in the language switcher modal"
        />
      </Dialog.Description>

      <Composite
        orientation="vertical"
        activeIndex={activeIndex}
        onNavigate={selectItem}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="listbox"
        className={styles["language-row-list"]}
        aria-busy={pending}
        aria-label={intl.formatMessage({
          id: "ui.language_switcher.language_list_label",
          defaultMessage: "List of available languages",
          description:
            "Aria label for the list of available languages in the language switcher",
        })}
      >
        {CHOICES.map((locale, index) => (
          <CompositeItem
            key={locale}
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="option"
            aria-selected={index === activeIndex}
            className={styles["language-row"]}
          >
            {locale === null ? (
              <FormattedMessage
                id="ui.language_switcher.browser_default"
                defaultMessage="Use browser settings ({language})"
                description="Option to use browser's default language in the language switcher"
                values={{
                  language: <LanguageName locale={bestLocale} />,
                }}
              />
            ) : (
              <LanguageName locale={locale} />
            )}
          </CompositeItem>
        ))}
      </Composite>
    </Dialog.Root>
  );
};
