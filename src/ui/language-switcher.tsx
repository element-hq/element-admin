import { PublicIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button, Tooltip } from "@vector-im/compound-web";
import { forwardRef, useState, useTransition } from "react";
import { FormattedDisplayName, FormattedMessage, useIntl } from "react-intl";

import * as Dialog from "@/components/dialog";
import { AVAILABLE_LOCALES, useBestLocale } from "@/intl";
import * as messages from "@/messages";
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
        size="sm"
        Icon={PublicIcon}
        iconOnly
      />
    </Tooltip>
  );
});

export const LanguageSwitcher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const intl = useIntl();
  const { selectedLocale, setLocale, clearLocale } = useLocaleStore();
  const bestLocale = useBestLocale();

  const handleLanguageSelect = (locale: string) => {
    if (locale !== selectedLocale) {
      startTransition(() => setLocale(locale));
    }
  };

  const handleClearSelection = () => {
    if (selectedLocale !== null) {
      startTransition(() => clearLocale());
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={setOpen}
      trigger={<LanguageSwitcherButton />}
    >
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

      <div className={styles["language-row-list"]} data-pending={pending}>
        <button
          type="button"
          className={styles["language-row"]}
          data-selected={selectedLocale === null}
          onClick={handleClearSelection}
        >
          <FormattedMessage
            id="ui.language_switcher.browser_default"
            defaultMessage="Use browser settings ({language})"
            description="Option to use browser's default language in the language switcher"
            values={{
              language: intl.formatDisplayName(bestLocale, {
                type: "language",
              }),
            }}
          />
        </button>

        {AVAILABLE_LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            className={styles["language-row"]}
            data-selected={selectedLocale === locale}
            onClick={() => handleLanguageSelect(locale)}
          >
            <FormattedDisplayName type="language" value={locale} />
          </button>
        ))}
      </div>

      <Dialog.Close asChild>
        <Button type="button" kind="tertiary">
          <FormattedMessage {...messages.actionClose} />
        </Button>
      </Dialog.Close>
    </Dialog.Root>
  );
};
