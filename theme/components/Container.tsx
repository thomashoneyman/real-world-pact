import { styled } from "../styled.config";

export const Grid = styled("div", { display: "grid" });

export const Flex = styled("div", { display: "flex" });

export const Box = styled("div", {});

export const Container = styled("div", {
  margin: "0 auto",

  defaultVariants: {
    size: "md",
  },

  variants: {
    size: {
      sm: {
        maxWidth: "$container-sm",
      },
      md: {
        maxWidth: "$container-md",
      },
      lg: {
        maxWidth: "$container-lg",
      },
      xl: {
        maxWidth: "$container-xl",
      },
    },
  },
});
