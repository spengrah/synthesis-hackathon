export const agreementAbi = [
  {
    type: "event",
    name: "AgreementStateChanged",
    inputs: [
      { name: "fromState", type: "bytes32", indexed: true },
      { name: "toState", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ProposalSubmitted",
    inputs: [
      { name: "proposer", type: "address", indexed: true },
      { name: "termsHash", type: "bytes32", indexed: false },
      { name: "proposalData", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgreementActivated",
    inputs: [
      { name: "agreement", type: "address", indexed: true },
      { name: "trustZones", type: "address[2]", indexed: false },
      { name: "zoneHatIds", type: "uint256[2]", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ZoneDeployed",
    inputs: [
      { name: "agreement", type: "address", indexed: true },
      { name: "trustZone", type: "address", indexed: true },
      { name: "zoneHatId", type: "uint256", indexed: true },
      { name: "party", type: "address", indexed: false },
      { name: "agentId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MechanismRegistered",
    inputs: [
      { name: "mechanismIndex", type: "uint256", indexed: true },
      { name: "paramType", type: "uint8", indexed: false },
      { name: "module", type: "address", indexed: false },
      { name: "zoneIndex", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ResourceTokenAssigned",
    inputs: [
      { name: "trustZone", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "tokenType", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ClaimFiled",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "mechanismIndex", type: "uint256", indexed: true },
      { name: "claimant", type: "address", indexed: true },
      { name: "evidence", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AdjudicationDelivered",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "verdict", type: "bool", indexed: false },
      { name: "actionTypes", type: "bytes32[]", indexed: false },
    ],
  },
  {
    type: "event",
    name: "CompletionSignaled",
    inputs: [
      { name: "party", type: "address", indexed: true },
      { name: "feedbackURI", type: "string", indexed: false },
      { name: "feedbackHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "ExitSignaled",
    inputs: [
      { name: "party", type: "address", indexed: true },
      { name: "feedbackURI", type: "string", indexed: false },
      { name: "feedbackHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AgreementClosed",
    inputs: [
      { name: "outcome", type: "bytes32", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ReputationFeedbackWritten",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "tag2", type: "string", indexed: false },
      { name: "feedbackURI", type: "string", indexed: false },
      { name: "feedbackHash", type: "bytes32", indexed: false },
    ],
  },
] as const;
