import { ChevronDownIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Avatar, Menu } from "@vector-im/compound-web";
import { useState } from "react";

import styles from "./header.module.css";
import { useIntl } from "react-intl";

export const Root: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <header className={styles["root"]}>{children}</header>
);

export const Left: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <div className={styles["left"]}>{children}</div>
);

export const Right: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <div className={styles["right"]}>{children}</div>
);

export const HomeserverName: React.FC<React.PropsWithChildren<{}>> = ({
  children,
}) => <p className={styles["homeserver-name"]}>{children}</p>;

export const UserMenu: React.FC<
  React.PropsWithChildren<{
    mxid: string;
    displayName?: string;
  }>
> = ({ children, mxid, displayName }) => {
  // TODO: compound-web shouldn't require us to have a controlled state here
  const [open, setOpen] = useState(false);
  const intl = useIntl();

  return (
    <Menu
      title={intl.formatMessage({
        id: "header.user_menu.title",
        defaultMessage: "Account menu",
        description:
          "The title of the menu which shows what account is logged in and have a few options like signing out",
      })}
      showTitle={false}
      open={open}
      onOpenChange={setOpen}
      align="end"
      trigger={
        <UserMenuButton mxid={mxid} displayName={displayName} open={open} />
      }
    >
      {children}
    </Menu>
  );
};

export const UserMenuProfile: React.FC<{
  mxid: string;
  displayName?: string | undefined;
}> = ({ mxid, displayName }) => (
  <div className={styles["user-menu-profile"]}>
    <Avatar size="88px" id={mxid} name={displayName || mxid} />
    <section className={styles["infos"]}>
      <p className={styles["display-name"]}>{displayName || mxid}</p>
      <p className={styles["mxid"]}>{mxid}</p>
    </section>
  </div>
);

const UserMenuButton: React.FC<
  {
    mxid: string;
    displayName?: string | undefined;
    open: boolean;
  } & React.ComponentProps<"button">
> = ({ mxid, displayName, open, ...props }) => (
  <button
    data-state={open ? "open" : "closed"}
    className={styles["user-menu-button"]}
    type="button"
    {...props}
  >
    <Avatar size="32px" id={mxid} name={displayName || mxid} />
    <ChevronDownIcon
      data-state={open ? "open" : "closed"}
      className={styles["icon"]}
    />
  </button>
);
