import {
  CheckIcon,
  CloseIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { InlineSpinner } from "@vector-im/compound-web";
import {
  Toaster as BaseToaster,
  resolveValue,
  type Toast as ToastContext,
} from "react-hot-toast";

import styles from "./toast.module.css";

const Toast = ({ t }: { t: ToastContext }) => (
  <div
    className={styles["root"]}
    data-state={t.visible ? "visible" : "hidden"}
    {...t.ariaProps}
  >
    {t.icon}
    <div className={styles["message"]}>{resolveValue(t.message, t)}</div>
  </div>
);

export const Toaster = () => (
  <BaseToaster
    position="bottom-center"
    toastOptions={{
      success: {
        icon: <CheckIcon />,
      },
      error: {
        icon: <CloseIcon />,
      },
      loading: {
        icon: <InlineSpinner />,
      },
    }}
  >
    {(t) => <Toast t={t} />}
  </BaseToaster>
);
