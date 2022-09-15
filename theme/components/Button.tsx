import { styled } from "../styled.config";

export const Button = styled("button", {
  color: "$mauve12",
  fontWeight: "bold",
  padding: "$2 $3",
  borderRadius: "$full",
  borderWidth: "0.125rem",
  borderStyle: "solid",
  fontSize: "$sm",
  minWidth: "6rem",

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
        "&:disabled": {
          cursor: "unset",
          color: "$blackA10",
          backgroundColor: "$blackA4",
          borderColor: "$blackA5",
        },
      },

      secondary: {
        backgroundColor: "$mauve2",
        borderColor: "$mauve2",
        "&:hover": {
          backgroundColor: "$mauve3",
          borderColor: "$mauve3",
        },
        "&:disabled": {
          cursor: "unset",
          color: "$blackA10",
          backgroundColor: "$blackA4",
          borderColor: "$blackA5",
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

export const IconButton = styled("button", {
  all: "unset",
  fontFamily: "inherit",
  borderRadius: "100%",
  height: 25,
  width: 25,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "crimson11",
  position: "absolute",
  top: 10,
  right: 10,
  cursor: "pointer",

  "&:hover": { backgroundColor: "$crimson4" },
  "&:focus": { boxShadow: "0 0 0 2px $crimson7" },
});
