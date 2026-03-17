export const resourceTokenRegistryAbi = [
  {
    type: "event",
    name: "TokenCreated",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "tokenType", type: "uint8", indexed: false },
      { name: "metadata", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "caller", type: "address", indexed: false },
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "id", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
