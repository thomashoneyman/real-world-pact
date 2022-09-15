import { Cross2Icon } from "@radix-ui/react-icons";
import { ReactNode, useEffect, useState } from "react";
import { Button, IconButton } from "../Button";
import { Box, Flex } from "../Container";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalTitle,
  ModalTrigger,
} from "../Modal";
import { Spinner } from "../Spinner";
import { Text } from "../Text";

export interface FormModalProps {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;

  renderForm: (renderActions: (isValid: boolean) => ReactNode) => ReactNode;
}

export const FormModal = (props: FormModalProps) => {
  const [open, setOpen] = useState(false);

  // Allow time for the form submission event to bubble up.
  const closeAfterDelay = async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    setOpen(false);
  };

  const renderActions = (isValid: boolean) => (
    <Flex css={{ marginTop: 25, justifyContent: "flex-end" }}>
      <Button disabled={!isValid} variant="primary" onClick={closeAfterDelay} type="submit">
        {props.confirmLabel}
      </Button>
    </Flex>
  );

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>{props.trigger}</ModalTrigger>

      <ModalContent>
        <ModalTitle>{props.title}</ModalTitle>

        <Text
          as="div"
          css={{ fontSize: "$md", color: "$mauve11", paddingTop: "$4", paddingBottom: "$4" }}
        >
          {props.description}
        </Text>

        {props.renderForm(renderActions)}

        <ModalClose asChild>
          <IconButton aria-label="Close">
            <Cross2Icon />
          </IconButton>
        </ModalClose>
      </ModalContent>
    </Modal>
  );
};

/* FORM REQUEST MODAL

This modal is for forms that should send a request on submit, and stay open
until the request has completed.

*/

export interface NotSent {
  status: "NOT_SENT";
}

export interface Pending {
  status: "PENDING";
}

export interface Error {
  status: "ERROR";
  message: string;
}

export interface Success {
  status: "SUCCESS";
}

export type ModalRequestStatus = NotSent | Pending | Error | Success;

export interface FormRequestModalProps {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: String;
  request: ModalRequestStatus;
  renderForm: (renderError: ReactNode, renderActions: (isValid: boolean) => ReactNode) => ReactNode;
}

export const FormRequestModal = (props: FormRequestModalProps) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (props.request.status === "SUCCESS") {
      setOpen(false);
    }
  }, [props.request]);

  const renderActions = (isValid: boolean) => (
    <Flex css={{ marginTop: 25, justifyContent: "flex-end" }}>
      <Button disabled={!isValid || props.request.status === "PENDING"} type="submit">
        {props.request.status === "PENDING" ? <Spinner /> : props.confirmLabel}
      </Button>
    </Flex>
  );

  const renderError = props.request.status === "ERROR" && (
    <Box css={{ paddingTop: "$4" }}>{props.request.message}</Box>
  );

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>{props.trigger}</ModalTrigger>

      <ModalContent>
        <ModalTitle>{props.title}</ModalTitle>

        <Text
          as="div"
          css={{ fontSize: "$md", color: "$mauve11", paddingTop: "$4", paddingBottom: "$4" }}
        >
          {props.description}
        </Text>

        {props.renderForm(renderError, renderActions)}

        <ModalClose asChild>
          <IconButton aria-label="Close">
            <Cross2Icon />
          </IconButton>
        </ModalClose>
      </ModalContent>
    </Modal>
  );
};

export const mergeStatuses = (a: ModalRequestStatus, b: ModalRequestStatus): ModalRequestStatus => {
  if (a.status === "PENDING") return a;
  if (b.status === "PENDING") return b;
  if (a.status === "ERROR") return a;
  if (b.status === "ERROR") return b;
  if (a.status === "NOT_SENT") return b;
  if (b.status === "NOT_SENT") return a;
  return { status: "SUCCESS" };
};
