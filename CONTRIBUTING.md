# Contributing

We welcome contributions to the YMax Portfolio UI! Please follow these guidelines to ensure your changes integrate smoothly.

Check your contributions with:
```bash
yarn lint
yarn test
```

## Working with Agoric Marshal

Agoric uses a custom marshalling system that's more expressive than JSON. Unlike JSON, it can serialize types like `bigint` and `undefined`:

```javascript
// JSON can't handle bigint or undefined
const data = { amount: 1000000n, result: undefined };
JSON.stringify(data); // Error: can't serialize bigint

// Agoric marshal handles these natively
marshaller.toCapData(data); // Works fine
```

Marshal also handles "remotables" - references to objects on other vats like contract instances or brands:

```javascript
// A brand reference looks like this in CapData:
{
  "body": "#\"$0.Alleged: IST brand\"", 
  "slots": ["board12345"]
}
```

### Using Board IDs to Refer to Remote Objects

Board IDs (like `"board12345"`) work like file descriptors - they're pieces of data you can pass around that refer to remote objects. Just as you can pass file descriptors across process boundaries and the kernel resolves them back to actual files, you can pass board IDs across the chain boundary and the marshaller resolves them back to actual contract instances or brands.

```javascript
// This is fine - working with the ID itself
const boardId = "board12345"; // ✅ Like `int fd = 0`

// This is wrong - treating the ID as the actual object
const brand = "board12345"; // ❌ Like `FILE *stdin = 0`

// This is correct - resolving the ID to get the actual object
const brand = marshaller.fromCapData(capData); // ✅ Like `FILE *stdin = fdopen(0, "r")`
```

For more examples of marshalling patterns, see the tests in `ui/src/components/TransactionHistory.test.tsx`.

## Working with wallet data and vstorage

VStorage is Agoric's on-chain key-value store for publishing contract and wallet state, documented at https://docs.agoric.com/reference/vstorage-ref.

Most dapp-relevant data lives under the `published.` prefix, which contains well-known contract instances, brands, wallet states, and other public information. When using `readPublished()` from client libraries, you provide paths without the `published.` prefix - the function automatically adds it and provides typed access to the structured data underneath.

Working with wallet data requires understanding Agoric's unique architecture where deterministic consensus makes traditional query patterns expensive. Instead of REST endpoints, Agoric uses notifiers and vstorage to publish state changes that off-chain clients can watch. The data contains object references (brands, instances) that need proper marshalling with board ID resolution.

For a detailed explanation of why you can't just poll wallet data like other APIs, see the discussion at https://github.com/Agoric/agoric-sdk/discussions/11770.
