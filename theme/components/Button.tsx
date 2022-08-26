import { styled } from "../styled.config";

export const Button = styled("button", {
  color: "$mauve12",
  fontWeight: "bold",
  padding: "$2 $3",
  borderRadius: "$full",
  borderWidth: "0.125rem",
  borderStyle: "solid",
  fontSize: "$sm",

  "&:hover": {
    cursor: "pointer",
  },

  defaultVariants: {
    variant: "primary",
  },

  variants: {
    variant: {
      primary: {
        backgroundColor: "$crimson9",
        borderColor: "$crimson9",
        "&:hover": {
          backgroundColor: "$crimson10",
          borderColor: "$crimson10",
        },
      },
      secondary: {
        backgroundColor: "$mauve2",
        borderColor: "$mauve2",
        "&:hover": {
          backgroundColor: "$mauve3",
          borderColor: "$mauve3",
        },
      },
    },

    outlined: {
      true: {},
    },
  },

  compoundVariants: [
    {
      variant: "primary",
      outlined: true,
      css: {
        color: "$crimson10",
        backgroundColor: "$mauve2",
        borderColor: "$crimson10",
        "&:hover": {
          color: "$crimson11",
          backgroundColor: "$crimson5",
          borderColor: "$crimson11",
        },
      },
    },

    {
      variant: "secondary",
      outlined: true,
      css: {
        borderColor: "$mauve12",
        "&:hover": {
          borderColor: "$mauve12",
        },
      },
    },
  ],
});
