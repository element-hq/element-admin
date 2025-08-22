import { ChevronDownIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Avatar, Menu } from "@vector-im/compound-web";
import { useState } from "react";
import { useIntl } from "react-intl";

import styles from "./header.module.css";

type RootProps = React.PropsWithChildren;
export const Root: React.FC<RootProps> = ({ children }: RootProps) => (
  <header className={styles["root"]}>{children}</header>
);

type LeftProps = React.PropsWithChildren;
export const Left: React.FC<LeftProps> = ({ children }: LeftProps) => (
  <div className={styles["left"]}>{children}</div>
);

type RightProps = React.PropsWithChildren;
export const Right: React.FC<RightProps> = ({ children }: RightProps) => (
  <div className={styles["right"]}>{children}</div>
);

type HomeserverNameProps = React.PropsWithChildren;
export const HomeserverName: React.FC<HomeserverNameProps> = ({
  children,
}: HomeserverNameProps) => (
  <p className={styles["homeserver-name"]}>{children}</p>
);

type UserMenuProps = React.PropsWithChildren<{
  mxid: string;
  displayName?: string | undefined;
  avatarUrl?: string | undefined;
}>;
export const UserMenu: React.FC<UserMenuProps> = ({
  children,
  mxid,
  displayName,
  avatarUrl,
}: UserMenuProps) => {
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
        <UserMenuButton
          mxid={mxid}
          displayName={displayName}
          avatarUrl={avatarUrl}
          open={open}
        />
      }
    >
      {children}
    </Menu>
  );
};

interface UserMenuProfileProps {
  mxid: string;
  avatarUrl?: string | undefined;
  displayName?: string | undefined;
}
export const UserMenuProfile: React.FC<UserMenuProfileProps> = ({
  mxid,
  displayName,
  avatarUrl,
}: UserMenuProfileProps) => (
  <div className={styles["user-menu-profile"]}>
    <Avatar size="88px" id={mxid} name={displayName || mxid} src={avatarUrl} />
    <section className={styles["infos"]}>
      <p className={styles["display-name"]}>{displayName || mxid}</p>
      <p className={styles["mxid"]}>{mxid}</p>
    </section>
  </div>
);

type UserMenuButtonProps = {
  mxid: string;
  displayName?: string | undefined;
  avatarUrl?: string | undefined;
  open: boolean;
} & React.ComponentProps<"button">;
const UserMenuButton: React.FC<UserMenuButtonProps> = ({
  mxid,
  displayName,
  avatarUrl,
  open,
  ...props
}: UserMenuButtonProps) => (
  <button
    data-state={open ? "open" : "closed"}
    className={styles["user-menu-button"]}
    type="button"
    {...props}
  >
    <Avatar size="32px" id={mxid} name={displayName || mxid} src={avatarUrl} />
    <ChevronDownIcon
      data-state={open ? "open" : "closed"}
      className={styles["icon"]}
    />
  </button>
);
