// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
// SPDX-FileCopyrightText: Copyright 2025, 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { FormattedMessage } from "react-intl";

import * as messages from "@/messages";

import { FilterButton } from "./data-table";
import styles from "./placeholder.module.css";

export const Text = () => <div className={styles["text"]} aria-hidden="true" />;

// The placeholder shapes are aria-hidden, so anything built out of them reads
// as empty. This is what a screen reader gets in their place.
export const Loading = () => (
  <span className="sr-only">
    <FormattedMessage {...messages.commonLoading} />
  </span>
);

export const LoadingText = () => (
  <>
    <Loading />
    <Text />
  </>
);

export const Avatar = () => (
  <div className={styles["avatar"]} aria-hidden="true" />
);

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
  <div className={styles["loading-table"]}>
    <Loading />
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
