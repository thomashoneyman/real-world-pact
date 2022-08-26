import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Flex } from "./Container";
import React, { ReactElement, ReactNode } from "react";
import { keyframes, styled } from "../styled.config";
import { Header } from "./Text";

const overlayShow = keyframes({
  "0%": { opacity: 0 },
  "100%": { opacity: 1 },
});

const contentShow = keyframes({
  "0%": { opacity: 0, transform: "translate(-50%, -48%) scale(.96)" },
  "100%": { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
});

const StyledOverlay = styled(DialogPrimitive.Overlay, {
  backgroundColor: "$blackA9",
  position: "fixed",
  inset: 0,
  "@media (prefers-reduced-motion: no-preference)": {
    animation: `${overlayShow} 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
  },
});

const StyledContent = styled(DialogPrimitive.Content, {
  backgroundColor: "$mauve1",
  borderRadius: 6,
  boxShadow:
    "hsl(206 22% 7% / 35%) 0px 10px 38px -10px, hsl(206 22% 7% / 20%) 0px 10px 20px -15px",
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "$container-sm",
  maxHeight: "85vh",
  padding: "$8",
  "@media (prefers-reduced-motion: no-preference)": {
    animation: `${contentShow} 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
  },
  "&:focus": { outline: "none" },
});

interface ModalContentProps {
  children: ReactNode;
}

const Content = ({ children, ...props }: ModalContentProps) => {
  return (
    <DialogPrimitive.Portal>
      <StyledOverlay />
      <StyledContent {...props}>{children}</StyledContent>
    </DialogPrimitive.Portal>
  );
};

const StyledTitle = styled(DialogPrimitive.Title, {});

const StyledDescription = styled(DialogPrimitive.Description, {
  margin: "$4 0",
  color: "$mauve11",
});

export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalContent = Content;
export const ModalTitle = StyledTitle;
export const ModalDescription = StyledDescription;
export const ModalClose = DialogPrimitive.Close;

export interface ModalProps {
  triggerButton: ReactElement;
  title: string;
  description: ReactElement;
  children: ReactNode;
  open: boolean;
}

export const ActionModal = (props: ModalProps) => {
  return (
    <Modal open={props.open}>
      <ModalTrigger asChild>{props.triggerButton}</ModalTrigger>
      <ModalContent>
        <Header as="h3" css={{ marginBottom: "$4" }}>
          {props.title}
        </Header>
        <ModalDescription as="div">{props.description}</ModalDescription>
        {props.children}
      </ModalContent>
    </Modal>
  );
};

export default ActionModal;
