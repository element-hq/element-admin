import { createLink } from "@tanstack/react-router";
import { Button } from "@vector-im/compound-web";
import { type PropsWithChildren, forwardRef } from "react";

type Props = {
  kind?: "primary" | "secondary" | "tertiary";
  size?: "sm" | "lg";
  Icon?: React.ComponentType<React.SVGAttributes<SVGElement>>;
  destructive?: boolean;
  disabled?: boolean;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>;

export const ButtonLink = createLink(
  forwardRef<HTMLAnchorElement, PropsWithChildren<Props>>(
    ({ children, ...props }, ref) => {
      const disabled = !!props.disabled || !!props["aria-disabled"] || false;
      return (
        <Button as="a" {...props} disabled={disabled} ref={ref}>
          {children}
        </Button>
      );
    },
  ),
);
