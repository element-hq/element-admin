// SPDX-FileCopyrightText: Copyright 2026 just-doks
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import type { MouseEventHandler } from "react";
import { Button } from "@vector-im/compound-web";
import styles from "./label-action.module.css";

interface LabelActionProps {
  Icon: React.ComponentType<React.SVGAttributes<SVGElement>>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: React.ReactNode;
}
export const LabelAction = ({ Icon, onClick, children }: LabelActionProps) => (
  <div className={styles["container"]}>
    <div className={styles["text"]}>{children}</div>
    <Button
      className={styles["icon"]}
      Icon={Icon}
      iconOnly
      size="sm"
      kind="tertiary"
      onClick={onClick}
    />
  </div>
);
