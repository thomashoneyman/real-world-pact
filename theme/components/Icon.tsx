import { CheckCircledIcon, CrossCircledIcon, TimerIcon } from "@radix-ui/react-icons";
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
  color: "$crimson11",

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

export const NotStartedIcon = styled(TimerIcon, {
  color: "$mauve9",

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
