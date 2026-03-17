export const agreementRegistryAbi = [
  {
    type: "event",
    name: "AgreementCreated",
    inputs: [
      { name: "agreement", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "agreementHatId", type: "uint256", indexed: false },
      { name: "partyA", type: "address", indexed: false },
      { name: "partyB", type: "address", indexed: false },
    ],
  },
] as const;
