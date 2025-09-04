import { createLink } from "@tanstack/react-router";
import { Button } from "@vector-im/compound-web";
import { type PropsWithChildren, forwardRef } from "react";

interface ButtonLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  kind?: "primary" | "secondary" | "tertiary";
  size?: "sm" | "lg";
  Icon?: React.ComponentType<React.SVGAttributes<SVGElement>>;
  iconOnly?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}

export const ButtonLink = createLink(
  forwardRef<HTMLAnchorElement, PropsWithChildren<ButtonLinkProps>>(
    function ButtonLink({ children, ...props }, ref) {
      const disabled = !!props.disabled || !!props["aria-disabled"] || false;
      return (
        <Button
          as="a"
          // Override a weird default that compound has on button links
          style={{ inlineSize: "initial " }}
          {...props}
          disabled={disabled}
          ref={ref}
        >
          {children}
        </Button>
      );
    },
  ),
);
