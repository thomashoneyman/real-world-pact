import { CheckCircledIcon, CrossCircledIcon } from "@radix-ui/react-icons";
import { styled } from "@stitches/react";

export const SuccessIcon = styled(CheckCircledIcon, {
  color: "$green9",

  variants: {
    size: {
      small: {
        height: "$3",
        width: "$3",
      },
      medium: {
        height: "$5",
        width: "$5",
      },
    },
  },

  defaultVariants: {
    size: "small",
  },
});

export const ErrorIcon = styled(CrossCircledIcon, {
  color: "$red9",

  variants: {
    size: {
      small: {
        height: "$3",
        width: "$3",
      },
      medium: {
        height: "$5",
        width: "$5",
      },
    },
  },

  defaultVariants: {
    size: "small",
  },
});
