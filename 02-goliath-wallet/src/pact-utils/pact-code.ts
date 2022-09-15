import * as Pact from "pact-lang-api";

// When we hit the Pact API we must send some Pact code. It can be awkward to
// represent Pact in JavaScript because the syntax is so different; we'll use
// this type to capture applying a function to arguments.
export interface PactCode {
  cmd: string;
  args: Array<PactCode | Pact.PactValue>;
}

// A helper function to format our representation of Pact code into a string
// that we can send off to Chainweb for evaluation.
export const formatPactCode = (code: PactCode): string => {
  const isPactCode = (p: any): p is PactCode => p.cmd && Array.isArray(p.args);
  const isPactInt = (p: any): p is Pact.PactInt => p.int;
  const isPactDecimal = (p: any): p is Pact.PactDecimal => p.decimal;

  const formatPactValue = (value: Pact.PactValue): string => {
    if (typeof value === "boolean") {
      return value.toString();
    } else if (typeof value === "string") {
      return `"${value}"`;
    } else if (isPactInt(value)) {
      return value.int;
    } else if (isPactDecimal(value)) {
      return value.decimal;
    } else if (Array.isArray(value)) {
      return `[ ${value.map(formatPactValue)} ]`;
    } else {
      for (const key in value) {
        value[key] = formatPactValue(value[key]);
      }
      return JSON.stringify(value);
    }
  };

  const format = (value: PactCode | Pact.PactValue): string => {
    if (isPactCode(value)) {
      return formatPactCode(value);
    } else {
      return formatPactValue(value);
    }
  };

  return `(${code.cmd} ${code.args.map(format).join(" ")})`;
};

// We'll validate that the provided input is parseable into a Pact decimal.
export const parsePactDecimal = (value: string): string | Pact.PactDecimal => {
  const split = value.split(".");
  const numbers = new RegExp("[0-9]+$");
  if (split.length === 1) {
    const parsed = parseFloat(split[0]);
    if (!numbers.test(split[0])) {
      return "Can only contain digits and a decimal point.";
    } else if (isNaN(parsed) || parsed < 0) {
      return "Invalid number.";
    } else {
      return { decimal: `${split[0]}.0` };
    }
  } else if (split.length === 2) {
    if (!numbers.test(split[0]) || !numbers.test(split[1])) {
      return "Can only contain digits and a decimal point.";
    }
    const parsedFirst = parseFloat(split[0]);
    const parsedSecond = parseFloat(split[1]);
    if (isNaN(parsedFirst) || parsedFirst < 0) {
      return "Invalid number before the decimal place.";
    } else if (isNaN(parsedSecond) || parsedSecond < 0) {
      return "Invalid number after the decimal place.";
    } else {
      return { decimal: `${parsedFirst.toString()}.${parsedSecond.toString()}` };
    }
  } else {
    return "Invalid number (more than one decimal point).";
  }
};
