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
import { Glass, Tooltip } from "@vector-im/compound-web";
import type { PropsWithChildren } from "react";
import { useIntl } from "react-intl";
import { Drawer } from "vaul";

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
}

export const Root: React.FC<RootProps> = ({
  trigger,
  open,
  asDrawer,
  onOpenChange,
  children,
}: RootProps) => {
  if (typeof asDrawer !== "boolean") {
    asDrawer = platform !== "other";
  }

  const intl = useIntl();

  if (asDrawer) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
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
              <DialogContent className={styles["body"]}>
                {children}

                <Tooltip
                  label={intl.formatMessage({
                    id: "action.close",
                    defaultMessage: "Close",
                    description: "Label for a 'close' action/button",
                  })}
                >
                  <Close className={styles["close"]}>
                    <CloseIcon />
                  </Close>
                </Tooltip>
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

export { Close, Description } from "@radix-ui/react-dialog";
