// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import {
  Close,
  Content as DialogContent,
  Overlay as DialogOverlay,
  Root as DialogRoot,
  Title as DialogTitle,
  Portal,
  Trigger,
} from "@radix-ui/react-dialog";
import { CloseIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Alert, Glass, Tooltip } from "@vector-im/compound-web";
import type { PropsWithChildren } from "react";
import { useIntl } from "react-intl";
import { Drawer } from "vaul";

import * as messages from "@/messages";

import styles from "./dialog.module.css";

// The granularity of this value is kind of arbitrary: it distinguishes exactly
// the platforms that this library needs to know about in order to correctly
// implement the designs.
let platform: "android" | "ios" | "other" = "other";

if (/android/i.test(navigator.userAgent)) {
  platform = "android";
  // We include 'Mac' here and double-check for touch support because iPads on
  // iOS 13 pretend to be a MacOS desktop
} else if (
  /iPad|iPhone|iPod|Mac/.test(navigator.userAgent) &&
  "ontouchend" in document
) {
  platform = "ios";
}

interface RootProps extends React.PropsWithChildren {
  trigger?: React.ReactNode;
  open?: boolean;
  asDrawer?: boolean;
  onOpenChange?: (open: boolean) => void;
  // When false, Escape, an outside click and the close button no longer
  // dismiss the dialog: the content has to offer its own way out.
  // That way out has to close the dialog through `open`/`onOpenChange`:
  // `Dialog.Close` alone does nothing, since vaul swallows every close on a
  // non-dismissible drawer.
  dismissible?: boolean;
}

const preventDefault = (event: Event): void => event.preventDefault();

export const Root: React.FC<RootProps> = ({
  trigger,
  open,
  asDrawer,
  onOpenChange,
  dismissible = true,
  children,
}: RootProps) => {
  if (typeof asDrawer !== "boolean") {
    asDrawer = platform !== "other";
  }

  const intl = useIntl();

  if (asDrawer) {
    return (
      <Drawer.Root
        open={open}
        onOpenChange={onOpenChange}
        dismissible={dismissible}
      >
        {trigger && <Trigger asChild>{trigger}</Trigger>}
        <Portal>
          <Drawer.Overlay className={styles["overlay"]} />
          <Drawer.Content className={styles["drawer"]} data-platform={platform}>
            <Drawer.Handle className={styles["handle"]} />
            <div className={styles["body"]}>{children}</div>
          </Drawer.Content>
        </Portal>
      </Drawer.Root>
    );
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      {trigger && <Trigger asChild>{trigger}</Trigger>}
      <Portal>
        {/* This container has a fixed position and scrolls over the Y axis if needed */}
        <DialogOverlay className={styles["scroll-container"]}>
          {/* This container is used as a flexbox parent to center the dialog */}
          <div className={styles["container"]}>
            <Glass className={styles["dialog"]}>
              <DialogContent
                className={styles["body"]}
                onEscapeKeyDown={dismissible ? undefined : preventDefault}
                onInteractOutside={dismissible ? undefined : preventDefault}
              >
                {children}

                {dismissible && (
                  <Tooltip label={intl.formatMessage(messages.actionClose)}>
                    <Close className={styles["close"]}>
                      <CloseIcon />
                    </Close>
                  </Tooltip>
                )}
              </DialogContent>
            </Glass>
          </div>
        </DialogOverlay>
      </Portal>
    </DialogRoot>
  );
};

type TitleProps = PropsWithChildren;
export const Title: React.FC<TitleProps> = ({ children }: TitleProps) => (
  <DialogTitle className={styles["title"]}>{children}</DialogTitle>
);

interface ErrorAlertProps {
  title: string;
}

// A mutation failure raised while the dialog is open: a toast would render in
// the app root, which the dialog marks `aria-hidden`, so nothing there reaches
// a screen reader. `role="alert"` is what announces it — the compound `Alert`
// is not a live region on its own.
export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  title,
}: ErrorAlertProps) => (
  <div role="alert">
    <Alert type="critical" title={title} />
  </div>
);

export { Close, Description } from "@radix-ui/react-dialog";
