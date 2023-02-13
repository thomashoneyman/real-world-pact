import { styled } from "@stitches/react";

export const Header = styled("h1", {
  marginBottom: "$2",
});

export const LinkStyles = {
  color: "$mauve12",
  textDecoration: "underline",
  fontWeight: "bold",

  "&:visited": {
    color: "$mauve12",
  },

  "&:active": {
    color: "$mauve12",
  },

  "&:hover": {
    cursor: "pointer",
    textDecoration: "none",
  },
};

export const Link = styled("a", LinkStyles);

export const Text = styled("p", {
  variants: {
    color: {
      primary: {
        color: "$crimson11",
      },
    },
  },
});
