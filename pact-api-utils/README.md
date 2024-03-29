# Pact API Utils

The `pact-api-utils` directory contains helper modules for working with the [`pact-lang-api`](https://github.com/kadena-io/pact-lang-api) library to make requests to the Pact endpoint on your local Chainweb node. There are four files:

- `types/pact-lang-api.d.ts` contains TypeScript type definitions for the parts of the `pact-lang-api` library that we're using. The underlying library is written in JavaScript, so this gives us types to work with.
- `src/pact-code.ts` has helpers for writing Pact code in JavaScript and then formatting it into a string appropriate to send to a Chainweb node for execution. We'll use this whenever we write Pact code.
- `src/pact-request.ts` has helpers for constructing requests to send to Chainweb. The requests we'll build are similar to the request files we used in Project 1, except they're fully configurable. Even better, we have helper functions to execute the request and record its status — either pending, or an error result, or a success result — as well as parse the result into a TypeScript type.
- `src/pact-request-hooks.ts` is a layer on top of `pact-request` that integrates the requests with React Hooks so it's easy to make a request and track its status (pending, error, or success) in state. We'll use these hooks in our UI.
