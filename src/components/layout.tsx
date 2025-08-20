import styles from "./layout.module.css";

const Layout: React.FC<React.PropsWithChildren> = ({ children }) => (
  <div className={styles["root"]}>{children}</div>
);

export default Layout;
