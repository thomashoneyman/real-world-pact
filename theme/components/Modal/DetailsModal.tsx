import { Cross2Icon } from "@radix-ui/react-icons";
import { ReactNode } from "react";
import { Button, IconButton } from "../Button";
import { Flex } from "../Container";
import { Modal, ModalClose, ModalContent, ModalTitle, ModalTrigger } from "../Modal";
import { Text } from "../Text";

export interface DetailsModalProps {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: ReactNode;
  children: ReactNode;
}

export const DetailsModal = (props: DetailsModalProps) => (
  <Modal>
    <ModalTrigger asChild>{props.trigger}</ModalTrigger>

    <ModalContent>
      <ModalTitle>{props.title}</ModalTitle>

      <Text
        as="div"
        css={{ fontSize: "$md", color: "$mauve11", paddingTop: "$4", paddingBottom: "$4" }}
      >
        {props.description}
      </Text>

      {props.children}

      <Flex css={{ marginTop: 25, justifyContent: "flex-end" }}>
        <ModalClose asChild>
          <Button variant="primary">{props.confirmLabel}</Button>
        </ModalClose>
      </Flex>

      <ModalClose asChild>
        <IconButton aria-label="Close">
          <Cross2Icon />
        </IconButton>
      </ModalClose>
    </ModalContent>
  </Modal>
);
