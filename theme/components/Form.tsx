import React from "react";
import { styled } from "../styled.config";

export const Fieldset = styled("fieldset", {
  display: "flex",
  flexDirection: "column",
  gap: "$2",
  marginBottom: "$3",
});

export const Label = styled("label", {
  fontSize: "$xs",
  color: "$crimson11",
});

export const Input = styled("input", {
  flex: "1",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
});
