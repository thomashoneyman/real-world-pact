import { ReactElement, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import {
  RequestStatus,
  PENDING,
  EXEC_ERROR,
  REQUEST_ERROR,
} from "@real-world-pact/utils/pact-request";

import { keyframes, styled } from "../styled.config";

import { Button, IconButton } from "./Button";
import { Box, Flex } from "./Container";
import { Text } from "./Text";
import { RequestErrorMessage } from "./Request";
import { Spinner } from "./Spinner";

const overlayShow = keyframes({
  "0%": { opacity: 0 },
  "100%": { opacity: 1 },
});

const StyledOverlay = styled(DialogPrimitive.Overlay, {
  backgroundColor: "$blackA9",
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "grid",
  placeItems: "center",
  overflowY: "auto",
  inset: 0,
  "@media (prefers-reduced-motion: no-preference)": {
    animation: `${overlayShow} 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
  },
});

const StyledContent = styled(DialogPrimitive.Content, {
  backgroundColor: "$mauve1",
  borderRadius: 6,
  padding: "$8",
  maxWidth: "$container-sm",
  position: "relative",
});

interface DialogContentProps {
  children: ReactNode;
  [x: string]: unknown;
}

const DialogTitle = styled(DialogPrimitive.Title, {});

const DialogDescription = styled("div", {
  margin: "$4 0",
  color: "$mauve11",
  fontSize: "$md",
});

const DialogContent = ({ children, ...props }: DialogContentProps) => {
  return (
    <DialogPrimitive.Portal>
      <StyledOverlay>
        <StyledContent {...props}>{children}</StyledContent>
      </StyledOverlay>
    </DialogPrimitive.Portal>
  );
};

/* MODAL IMPLEMENTATIONS */

export interface ModalProps {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}

export const Modal = (props: ModalProps) => (
  <DialogPrimitive.Root>
    <DialogPrimitive.Trigger asChild>{props.trigger}</DialogPrimitive.Trigger>

    <DialogContent>
      <DialogTitle>{props.title}</DialogTitle>

      <DialogDescription>{props.description}</DialogDescription>

      {props.children}

      <DialogPrimitive.Close asChild>
        <IconButton aria-label="Close">
          <Cross2Icon />
        </IconButton>
      </DialogPrimitive.Close>
    </DialogContent>
  </DialogPrimitive.Root>
);

export interface ControlledModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
}

export const ControlledModal = (props: ControlledModalProps) => (
  <DialogPrimitive.Root open={props.open} onOpenChange={props.onOpenChange}>
    <DialogPrimitive.Trigger asChild>{props.trigger}</DialogPrimitive.Trigger>

    <DialogContent>
      <DialogTitle>{props.title}</DialogTitle>

      <DialogDescription>{props.description}</DialogDescription>

      {props.children}

      <DialogPrimitive.Close asChild>
        <IconButton aria-label="Close">
          <Cross2Icon />
        </IconButton>
      </DialogPrimitive.Close>
    </DialogContent>
  </DialogPrimitive.Root>
);

/* MODAL BUTTONS */

export interface CloseButtonProps {
  label: ReactNode;
}

export const CloseButton = ({ label }: CloseButtonProps) => {
  return (
    <Flex css={{ marginTop: "$4", justifyContent: "flex-end" }}>
      <DialogPrimitive.Close asChild>
        <Button variant="primary">{label}</Button>
      </DialogPrimitive.Close>
    </Flex>
  );
};

export interface FormSubmitButtonProps {
  isValid: boolean;
  label: ReactNode;
  onOpenChange: (open: boolean) => void;
}

export const FormSubmitButton = ({ isValid, label, onOpenChange }: FormSubmitButtonProps) => {
  // Allow time for the form submission event to bubble up.
  const closeAfterDelay = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    onOpenChange(false);
  };

  return (
    <Flex css={{ marginTop: "$4", justifyContent: "flex-end" }}>
      <Button disabled={!isValid} variant="primary" onClick={closeAfterDelay} type="submit">
        {label}
      </Button>
    </Flex>
  );
};

export interface FormRequestButtonProps extends FormSubmitButtonProps {
  closeOnSubmit?: boolean;
  request: null | RequestStatus<any> | (null | RequestStatus<any>)[];
}

export const FormRequestButton = (props: FormRequestButtonProps): ReactElement => {
  // Allow time for the form submission event to bubble up.
  const closeAfterDelay = async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    if (props.closeOnSubmit) {
      props.onOpenChange(false);
    }
  };

  const isPending = (() => {
    if (!props.request) {
      return false;
    } else if (Array.isArray(props.request)) {
      const filtered = props.request.flatMap((value) => (value ? [value] : []));
      return filtered.reduce((previous, current) => previous || current.status === PENDING, false);
    } else {
      return props.request.status === PENDING;
    }
  })();

  const isValid = props.isValid && !isPending;

  const variant = isPending ? "secondary" : "primary";

  return (
    <Box>
      <RequestErrorMessage request={props.request} />
      <Flex css={{ marginTop: "$4", justifyContent: "flex-end" }}>
        <Button disabled={!isValid} variant={variant} onClick={closeAfterDelay} type="submit">
          {isPending ? <Spinner size="small" /> : props.label}
        </Button>
      </Flex>
    </Box>
  );
};
