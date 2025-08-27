import styles from "./placeholder.module.css";
import { FilterButton } from "./table";

const Text = () => <div className={styles["text"]} aria-hidden="true" />;

const Avatar = () => <div className={styles["avatar"]} aria-hidden="true" />;

type GroupProps = React.PropsWithChildren;
const Group = ({ children }: GroupProps) => (
  <div className={styles["group"]} aria-hidden="true">
    {children}
  </div>
);

const TableRow = () => (
  <div className={styles["table-row"]} aria-hidden="true">
    <Avatar />
    <Text />
  </div>
);

const TableControls = () => (
  <div className={styles["table-controls"]} aria-hidden="true">
    <Text />
    <FilterButton />
  </div>
);

const TableHeader = () => (
  <div className={styles["table-header"]} aria-hidden="true">
    <Text />
  </div>
);

export const LoadingTable = () => (
  <div className={styles["loading-table"]} aria-hidden="true">
    <TableControls />
    <TableHeader />
    <Group>
      <TableRow />
      <TableRow />
      <TableRow />
      <TableRow />
      <TableRow />
      <TableRow />
      <TableRow />
      <TableRow />
      <TableRow />
      <TableRow />
    </Group>
  </div>
);
