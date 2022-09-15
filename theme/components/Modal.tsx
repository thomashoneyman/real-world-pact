import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ReactNode } from "react";
import { keyframes, styled } from "../styled.config";

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
});

interface ModalContentProps {
  children: ReactNode;
  [x: string]: any;
}

const Content = ({ children, ...props }: ModalContentProps) => {
  return (
    <DialogPrimitive.Portal>
      <StyledOverlay>
        <StyledContent {...props}>{children}</StyledContent>
      </StyledOverlay>
    </DialogPrimitive.Portal>
  );
};

const StyledTitle = styled(DialogPrimitive.Title, {});

const StyledDescription = styled("div", {
  margin: "$4 0",
  color: "$mauve11",
});

export const Modal = DialogPrimitive.Root;
export const ModalTrigger = DialogPrimitive.Trigger;
export const ModalContent = Content;
export const ModalTitle = StyledTitle;
export const ModalDescription = StyledDescription;
export const ModalClose = DialogPrimitive.Close;
