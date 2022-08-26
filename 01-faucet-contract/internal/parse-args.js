/* INTERNAL

The code below is for argument parsing and has nothing to do with Pact or
sending requests to Chainweb. Read it if you'd like, but you can safely
ignore it, too.
*/

const fs = require("node:fs/promises");
const path = require("node:path");
const process = require("node:process");

// Parse the command-line arguments. Available options:
//
// --local : String
// --format-only : Boolean
// --raw : Boolean
// --send : String
// --signer : [String]
//
// Returns arguments of the format:
// --send, --signers: { "send": "send-file-name", "signers": [ "key-file-name" ] }
// --local: { "local": "local-file-name" }
// --format-only: the above, except with { "format-only": true } included.
// --raw: the above, except with { "raw": true } included.
exports.parseArgs = async (argv) => {
  const trimExtension = (entries) =>
    entries.map((path) => path.substring(0, path.length - 5));

  const keysDir = await fs.readdir(path.join(__dirname, "..", "yaml", "keys"));
  const keys = trimExtension(keysDir);

  const localDir = await fs.readdir(
    path.join(__dirname, "..", "yaml", "local")
  );
  const local = trimExtension(localDir);

  const sendDir = await fs.readdir(path.join(__dirname, "..", "yaml", "send"));
  const send = trimExtension(sendDir);

  const availableLocal = `Available --local requests:${[""]
    .concat(local)
    .join("\n  - ")}`;
  const availableSend = `Available --send requests:${[""]
    .concat(send)
    .join("\n  - ")}`;

  if (argv.length === 0) {
    throw new Error(
      [
        "No arguments provided. Expected --send or --local.",
        `\n${availableLocal}`,
        `\n${availableSend}`,
        `  ...using --signers from: ${keys.join(", ")}`,
      ].join("\n")
    );
  }

  const results = {};

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];

    if (!key.startsWith("--"))
      throw new Error(`Arguments must begin with "--", but received ${key}`);

    // Attempt to read the argument for the provided key.
    const peekArg = () => {
      if (i + 1 === argv.length) {
        const error = `Expected a value for argument ${key}, but reached the end of input.`;
        let help;
        if (argv[i] === "--local") {
          help = availableLocal;
        } else if (argv[i] === "--send") {
          help = availableSend;
        } else if (argv[i] === "--signers") {
          help = `Available signers: ${keys.join(", ")}`;
        } else {
          help = "";
        }
        throw new Error([error, help].join("\n"));
      } else if (argv[i + 1].startsWith("--")) {
        throw new Error(
          `Argument ${key} requires a value, but received another argument instead: ${
            argv[i + 1]
          }`
        );
      } else if (argv[i + 1].length < 3) {
        throw new Error(
          `Argument ${key} received an argument that is too short (< 3 chars): ${
            argv[i + 1]
          }`
        );
      }
      // We've consumed an argument, so we should step the position.
      else {
        i++;
        return argv[i];
      }
    };

    const keyname = key.slice(2);
    if (results[keyname] && keyname === "signers") {
      throw new Error(
        "Received duplicate argument for 'signers'. Signers should be comma separated, ie. '--signers a,b,c'"
      );
    } else if (results[keyname]) {
      throw new Error(`Received duplicate argument for ${key}.`);
    }

    switch (keyname) {
      case "format-only":
        results["format-only"] = true;
        break;

      case "raw":
        results["raw"] = true;
        break;

      case "send":
        const sendArg = peekArg();
        if (sendArg.endsWith(".yaml")) {
          throw new Error(
            `Value for 'send' ends in '.yaml' but should not have a file extension: ${sendArg}`
          );
        } else if (!send.find((elem) => elem == sendArg)) {
          throw new Error(
            `Value for 'send' has no corresponding request file: ${sendArg}. ${availableSend}`
          );
        } else {
          results["send"] = sendArg;
        }
        break;

      case "local":
        const localArg = peekArg();
        if (localArg.endsWith(".yaml")) {
          throw new Error(
            `Value for 'local' ends in '.yaml' but should not have a file extension: ${localArg}`
          );
        } else if (!local.find((elem) => elem == localArg)) {
          throw new Error(
            `Value for 'local' has no corresponding request file: ${localArg}. ${availableLocal}`
          );
        } else {
          results["local"] = localArg;
        }
        break;

      case "signers":
        const signersArg = peekArg();
        const signersSplit = signersArg.split(",");
        for (
          let signerIndex = 0;
          signerIndex < signersSplit.length;
          signerIndex++
        ) {
          const signer = signersSplit[signerIndex];
          if (signer.includes(" ")) {
            throw new Error(
              `Signer value contains a space. Signers should be comma-separated, ie. '--signers a,b,c`
            );
          } else if (signer.endsWith(".yaml")) {
            throw new Error(
              `Signer ends in '.yaml' but should not have a file extension: ${signer}`
            );
          } else if (!keys.find((elem) => elem == signer)) {
            throw new Error(
              `Signer has no corresponding keys: ${signer}. Available keys: ${keys.join(
                ", "
              )}`
            );
          } else {
            results["signers"]
              ? results["signers"].push(signer)
              : (results["signers"] = [signer]);
          }
        }
        break;

      default:
        throw new Error(
          `Unrecognized key: ${key}. Expected one of --send, --signers, --local, --format-only`
        );
        break;
    }
  }

  if (results["local"] && (results["send"] || results["signers"])) {
    throw new Error("--local cannot be used with --send or --signers.");
  } else if (results["send"] && !results["signers"]) {
    throw new Error("--send must be used with --signers.");
  }

  return results;
};
