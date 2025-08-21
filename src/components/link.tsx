import { createLink } from "@tanstack/react-router";
import { Button } from "@vector-im/compound-web";
import { type PropsWithChildren, forwardRef } from "react";

type ButtonLinkProps = {
  kind?: "primary" | "secondary" | "tertiary";
  size?: "sm" | "lg";
  Icon?: React.ComponentType<React.SVGAttributes<SVGElement>>;
  destructive?: boolean;
  disabled?: boolean;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>;

export const ButtonLink = createLink(
  forwardRef<HTMLAnchorElement, PropsWithChildren<ButtonLinkProps>>(
    function ButtonLink({ children, ...props }, ref) {
      const disabled = !!props.disabled || !!props["aria-disabled"] || false;
      return (
        <Button as="a" {...props} disabled={disabled} ref={ref}>
          {children}
        </Button>
      );
    },
  ),
);

type ChatFilterLinkProps = {
  selected?: boolean;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>;

export const ChatFilterLink = createLink(
  forwardRef<HTMLAnchorElement, PropsWithChildren<ChatFilterLinkProps>>(
    function ChatFilterLink({ children, ...props }, ref) {
      return (
        <a
          {...props}
          ref={ref}
          role="tab"
          data-selected={props.selected || undefined}
          aria-selected={props.selected || undefined}
          className="
            cpd-font-body-sm-medium text-text-primary
            px-2 py-1
            bg-transparent border-1 border-border-interactive-secondary rounded-full
            hover:border-border-interactive-primary hover:bg-bg-subtle-primary
            data-selected:border-bg-action-primary-rest data-selected:bg-bg-action-primary-rest data-selected:text-text-on-solid-primary
          "
        >
          {children}
        </a>
      );
    },
  ),
);
