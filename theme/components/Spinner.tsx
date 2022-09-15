import { keyframes, styled } from "../styled.config";

const spin = keyframes({
  "0%": {
    transform: "rotate(0deg)",
  },
  "100%": {
    transform: "rotate(360deg)",
  },
});

export const Spinner = styled("span", {
  display: "inline-block",
  borderColor: "$crimson9",
  borderStyle: "solid",
  borderRadius: "99999px",
  borderWidth: "2px",
  borderBottomColor: "transparent",
  borderLeftColor: "transparent",
  animation: `${spin} 0.45s linear infinite`,

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
