import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import clsx from "classnames";
import { forwardRef, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { FormattedMessage, FormattedNumber, useIntl } from "react-intl";

import * as Placeholder from "@/components/placeholder";
import * as messages from "@/messages";

import styles from "./data.module.css";

type GridProps = Omit<React.ComponentProps<"div">, "role">;
export const Grid = forwardRef<HTMLDivElement, GridProps>(function Grid(
  { children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="list"
      className={clsx(styles["grid"], className)}
      {...props}
    >
      <div className={styles["grid-inner"]}>{children}</div>
    </div>
  );
});

type ItemProps = Omit<React.ComponentProps<"div">, "role">;
export const Item = forwardRef<HTMLDivElement, ItemProps>(function Item(
  { children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="listitem"
      className={clsx(styles["item"], className)}
      {...props}
    >
      {children}
    </div>
  );
});

type TitleProps = Omit<React.ComponentProps<"div">, "role">;
export const Title = forwardRef<HTMLDivElement, TitleProps>(function Title(
  { children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="term"
      className={clsx(styles["title"], className)}
      {...props}
    >
      {children}
    </div>
  );
});

type ValueProps = Omit<React.ComponentProps<"div">, "role">;
export const Value = forwardRef<HTMLDivElement, ValueProps>(function Value(
  { children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="definition"
      className={clsx(styles["value"], className)}
      {...props}
    >
      {children}
    </div>
  );
});

// To display a value which suspends and might throw an error, with a proper
// loading placeholder and error fallback
//
// The extra props are applied to the error and loading fallbacks, not the value
// itself
type DynamicValueProps = ValueProps;
export const DynamicValue = ({ children, ...props }: DynamicValueProps) => {
  const queryError = useQueryErrorResetBoundary();
  return (
    <ErrorBoundary
      onReset={queryError.reset}
      fallbackRender={({ resetErrorBoundary }) => (
        <Error {...props} onRetry={resetErrorBoundary} />
      )}
    >
      <Suspense fallback={<LoadingValue {...props} />}>{children}</Suspense>
    </ErrorBoundary>
  );
};

// Component to display a numeric value, formatted according to the current
// locale, and with a proper aria-label fallback
interface NumericValueProps
  extends Omit<ValueProps, "children" | "aria-label" | "style">,
    Pick<Intl.NumberFormatOptions, "unit" | "style" | "currency"> {
  value: number | bigint;
}
export const NumericValue = forwardRef<HTMLDivElement, NumericValueProps>(
  function NumericValue({ value, unit, style, currency, ...props }, ref) {
    const intl = useIntl();
    return (
      <Value
        {...props}
        aria-label={intl.formatNumber(value, {
          unit,
          style,
          currency,
          // This makes sure the aria-label is human-readable:
          //  - useGrouping: false so that there is no space/comma between thousands
          //  - currencyDisplay: name so that currencies use their full human-readable names
          //  - unitDisplay: long so that units use their full human-readable names
          useGrouping: false,
          currencyDisplay: "name",
          unitDisplay: "long",
        })}
        ref={ref}
      >
        <FormattedNumber
          value={value}
          unit={unit}
          style={style}
          currency={currency}
        />
      </Value>
    );
  },
);

interface ErrorProps extends Omit<ValueProps, "aria-invalid" | "children"> {
  onRetry: React.MouseEventHandler<HTMLButtonElement>;
}
const Error = forwardRef<HTMLDivElement, ErrorProps>(function Error(
  { onRetry, ...props },
  ref,
) {
  return (
    <Value {...props} aria-invalid="true" ref={ref}>
      <ErrorIcon aria-hidden="true" />
      <FormattedMessage
        id="ui.data.failed_to_load"
        description="In a data grid, when a specific data value failed to load"
        defaultMessage="Failed to load"
      />
      <button onClick={onRetry}>
        <FormattedMessage {...messages.actionRetry} />
      </button>
    </Value>
  );
});

type LoadingValueProps = Omit<
  ValueProps,
  "aria-busy" | "aria-label" | "children"
>;
const LoadingValue = forwardRef<HTMLDivElement, LoadingValueProps>(
  function LoadingValue(props, ref) {
    const intl = useIntl();
    return (
      <Value
        {...props}
        aria-busy="true"
        aria-label={intl.formatMessage({
          id: "ui.data.loading",
          defaultMessage: "Loading value",
          description:
            "In a data grid, aria label for when a data value is loading",
        })}
        ref={ref}
      >
        <Placeholder.Text />
      </Value>
    );
  },
);
