import { globalCss } from "@stitches/react";
import { ReactElement } from "react";

const globalStyles = globalCss({
  "*, *:before, *:after": {
    boxSizing: "border-box",
  },

  "*": {
    margin: 0,
  },

  "html, body": {
    height: "100%",
  },

  body: {
    "-webkit-font-smoothing": "antialiased",
    backgroundColor: "$mauve1",
    fontFamily: "$sansSerif",
    fontSize: "$md",
    lineHeight: "$base",
    color: "$mauve12",
  },

  fieldset: {
    border: 0,
    padding: "0.01em 0 0 0",
    margin: 0,
    minWidth: 0,
  },

  "img, picture, video, canvas, svg": {
    display: "block",
    maxWidth: "100%",
  },

  "input, button, textarea, select": {
    font: "inherit",
  },

  "p, h1, h2, h3, h4, h5, h6": {
    overflowWrap: "break-word",
  },

  "h1, h2, h3, h4, h5, h6": {
    fontWeight: "bold",
  },

  input: {
    borderRadius: 4,
    padding: "$1 $2",
    fontSize: "$base",
    color: "$mauve12",
    height: 35,
    border: "1px solid $mauve11",

    "&:focus": {
      outline: "1px solid $crimson11",
      border: "1px solid $crimson11",
    },
  },

  h1: {
    fontSize: "$3xl",
    lineHeight: "$xs",
  },

  h2: {
    fontSize: "$2xl",
    lineHeight: "$xs",
  },

  h3: {
    fontSisez: "$xl",
    lineHeight: "$xs",
  },
});

interface GlobalProps {
  children: ReactElement;
}

export const GlobalStyles = ({ children }: GlobalProps) => {
  globalStyles();
  return children;
};
