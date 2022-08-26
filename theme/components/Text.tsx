import { styled } from "@stitches/react";

export const Header = styled("h1", {});

export const Link = styled("a", {
  textDecoration: "underline",
  fontWeight: "bold",

  "&:hover": {
    cursor: "pointer",
    textDecoration: "none",
  },
});

export const Text = styled("p", {
  variants: {
    color: {
      primary: {
        color: "$crimson11",
      },
    },
  },
});
