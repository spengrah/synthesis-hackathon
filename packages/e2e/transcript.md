# Trust Zones E2E Demo Transcript

Generated: 2026-03-18T03:51:49.618Z
Duration: 40.9s

## Setup


`13.5s` **Deployed all contracts via DeployAll.s.sol**

```json
{
  "agreementRegistry": "0xD65FC9e752703495b7460243434466e744BFEfEc",
  "resourceTokenRegistry": "0x3935F1C7621F1547E5aB9637B6b2e6eCb2d28876",
  "agreementImpl": "0x1Dd0842f755BD0A2632b32F5194bbdaECe505A42"
}
```

`16.6s` Ponder indexer started

```json
{
  "url": "http://localhost:42069/graphql"
}
```

`16.6s` Mock data API started

```json
{
  "port": 42070
}
```

## Beat 1: Negotiate


`16.6s` **partyA constructs a TZSchemaDocument (compiler input)**

```json
{
  "version": "0.1.0",
  "adjudicator": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "deadline": "2026-03-25T03:51:08.000Z",
  "zones": [
    {
      "index": 0,
      "party": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "hat": "Zone A — Market Data Provider",
      "mechanisms": [
        "incentive:staking({\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"minStake\":\"1000000\",\"cooldownPeriod\":86400})"
      ],
      "permissions": [
        "social-graph-read [100/hour]"
      ],
      "responsibilities": [
        "Provide market data with <5s latency"
      ],
      "directives": [
        "Do not re-publish or redistribute received data to third parties",
        "Do not use received data to produce outputs that harm individuals or groups"
      ]
    },
    {
      "index": 1,
      "party": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "hat": "Zone B — Social Graph Provider",
      "mechanisms": [
        "incentive:staking({\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"minStake\":\"1000000\",\"cooldownPeriod\":86400})"
      ],
      "permissions": [
        "market-data-read [50/hour]"
      ],
      "responsibilities": [
        "Provide social graph data"
      ],
      "directives": [
        "Do not re-publish or redistribute received data to third parties",
        "Do not use received data to produce outputs that harm individuals or groups"
      ]
    }
  ]
}
```

`16.6s` Compiler produces ProposalData (ABI-encoded proposal)

```json
{
  "termsDocUri": "(empty)",
  "adjudicator": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "deadline": "1774410668",
  "zones": [
    {
      "index": 0,
      "party": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "mechanismCount": 1,
      "mechanisms": [
        {
          "paramType": 6,
          "moduleKind": 0,
          "module": "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7",
          "dataLength": 578
        }
      ],
      "resourceTokenCount": 4
    },
    {
      "index": 1,
      "party": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "mechanismCount": 1,
      "mechanisms": [
        {
          "paramType": 6,
          "moduleKind": 0,
          "module": "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7",
          "dataLength": 578
        }
      ],
      "resourceTokenCount": 4
    }
  ]
}
```

`16.6s` **partyA submits proposal to AgreementRegistry.createAgreement()**

`21.4s` Agreement created

```json
{
  "agreement": "0x96d89AB873F658663541f9164e6fC87DaECcB369"
}
```

`21.7s` - [x] State = PROPOSED

`21.7s` - [x] Both parties indexed correctly

`21.7s` **partyB queries Ponder for partyA's proposal**

```json
{
  "proposer": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "termsHash": "0xabbb47be651529d1b58243a0f2768f9c70106f5409d80f99d9ba14a45c68e6f2",
  "payloadSize": "10818 chars"
}
```

`21.7s` SDK decodes ABI-encoded ProposalData

```json
{
  "termsDocUri": "(empty)",
  "adjudicator": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "deadline": "1774410668",
  "zones": [
    {
      "index": 0,
      "party": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "mechanismCount": 1,
      "mechanisms": [
        {
          "paramType": 6,
          "moduleKind": 0,
          "module": "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7",
          "dataLength": 578
        }
      ],
      "resourceTokenCount": 4
    },
    {
      "index": 1,
      "party": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "mechanismCount": 1,
      "mechanisms": [
        {
          "paramType": 6,
          "moduleKind": 0,
          "module": "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7",
          "dataLength": 578
        }
      ],
      "resourceTokenCount": 4
    }
  ]
}
```

`21.7s` Compiler decompiles into TZSchemaDocument (partyB can now read the terms)

```json
{
  "version": "0.1.0",
  "adjudicator": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "deadline": "2026-03-25T03:51:08.000Z",
  "zones": [
    {
      "index": 0,
      "party": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "hat": "Zone A — Market Data Provider",
      "mechanisms": [
        "incentive:staking({\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"minStake\":\"1000000\",\"cooldownPeriod\":86400})"
      ],
      "permissions": [
        "social-graph-read [100/hour]"
      ],
      "responsibilities": [
        "Provide market data with <5s latency"
      ],
      "directives": [
        "Do not re-publish or redistribute received data to third parties",
        "Do not use received data to produce outputs that harm individuals or groups"
      ]
    },
    {
      "index": 1,
      "party": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "hat": "Zone B — Social Graph Provider",
      "mechanisms": [
        "incentive:staking({\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"minStake\":\"1000000\",\"cooldownPeriod\":86400})"
      ],
      "permissions": [
        "market-data-read [50/hour]"
      ],
      "responsibilities": [
        "Provide social graph data"
      ],
      "directives": [
        "Do not re-publish or redistribute received data to third parties",
        "Do not use received data to produce outputs that harm individuals or groups"
      ]
    }
  ]
}
```

`21.7s` **partyB modifies Zone B: market-data-read rate limit 50/hour → 200/hour**

```json
{
  "version": "0.1.0",
  "adjudicator": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "deadline": "2026-03-25T03:51:08.000Z",
  "zones": [
    {
      "index": 0,
      "party": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "hat": "Zone A — Market Data Provider",
      "mechanisms": [
        "incentive:staking({\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"minStake\":\"1000000\",\"cooldownPeriod\":86400})"
      ],
      "permissions": [
        "social-graph-read [100/hour]"
      ],
      "responsibilities": [
        "Provide market data with <5s latency"
      ],
      "directives": [
        "Do not re-publish or redistribute received data to third parties",
        "Do not use received data to produce outputs that harm individuals or groups"
      ]
    },
    {
      "index": 1,
      "party": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "hat": "Zone B — Social Graph Provider",
      "mechanisms": [
        "incentive:staking({\"token\":\"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\",\"minStake\":\"1000000\",\"cooldownPeriod\":86400})"
      ],
      "permissions": [
        "market-data-read [200/hour]"
      ],
      "responsibilities": [
        "Provide social graph data"
      ],
      "directives": [
        "Do not re-publish or redistribute received data to third parties",
        "Do not use received data to produce outputs that harm individuals or groups"
      ]
    }
  ]
}
```

`21.7s` Compiler produces counter ProposalData

```json
{
  "termsDocUri": "(empty)",
  "adjudicator": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "deadline": "1774410668",
  "zones": [
    {
      "index": 0,
      "party": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "mechanismCount": 1,
      "mechanisms": [
        {
          "paramType": 6,
          "moduleKind": 0,
          "module": "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7",
          "dataLength": 578
        }
      ],
      "resourceTokenCount": 4
    },
    {
      "index": 1,
      "party": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      "mechanismCount": 1,
      "mechanisms": [
        {
          "paramType": 6,
          "moduleKind": 0,
          "module": "0x9E01030aF633Be5a439DF122F2eEf750b44B8aC7",
          "dataLength": 578
        }
      ],
      "resourceTokenCount": 4
    }
  ]
}
```

`21.7s` **partyB submits counter via submitInput(COUNTER, payload)**

`22.8s` - [x] State = NEGOTIATING

`22.8s` - [x] 2 proposals indexed (original + counter)

`22.8s` **partyA accepts the counter-proposal**

`23.8s` - [x] State = ACCEPTED

## Beat 2: Set Up + Stake + Activate


`23.8s` **partyA triggers SET_UP — deploys TZ accounts, staking modules, resource tokens**

`26.8s` Two trust zones deployed

```json
{
  "Zone A (Market Data)": "0xa17f703da7b914d9111695ce1fa04d394bd70690",
  "Zone B (Social Graph)": "0x19fd46b37dae25db22967fc3e32d61be4c52d9cf"
}
```

`26.8s` - [x] State = READY

`26.8s` - [x] 2 trust zone accounts deployed

`26.8s` **Deal USDC to both parties and stake into eligibility modules**

```json
{
  "stakingModuleA": "0x1bad758EdCcfD07D9390e47A1d7f95da848cF3B1",
  "stakingModuleB": "0x63bD9c74de322B7db4CBDd9f49576374a3fa60Fa",
  "stakeAmount": "1000000 (1 USDC)",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```

`28.3s` partyA staked 1000000 USDC into 0x1bad...F3B1

`28.3s` partyB staked 1000000 USDC into 0x63bD...60Fa

`28.3s` - [x] Both parties meet staking eligibility requirements

`28.3s` **partyA triggers ACTIVATE — mints zone hats to parties (eligibility enforced)**

`29.7s` Agreement is now ACTIVE — both parties wearing zone hats

```json
{
  "zoneHatA": "50307260892285510288885547371884762265767745404560777013578766596702208",
  "zoneHatB": "50307260892291787390620934052648598055190953070976879369023230631215104"
}
```

`29.7s` - [x] State = ACTIVE

`29.7s` - [x] Zone hats minted to both parties

## Beat 3: Happy Path — Data Exchange


`29.7s` **Agent B (TZ Account 0x19fd...d9cf) requests /market-data**

`29.7s` 200 OK — market data returned

```json
{
  "pairs": [
    {
      "base": "ETH",
      "quote": "USD",
      "price": 3500
    }
  ]
}
```

`29.7s` - [x] Authorized request succeeds with valid data

`29.7s` **Agent A (TZ Account 0xa17f...0690) requests /social-graph**

`29.7s` 200 OK — social graph data returned

```json
{
  "nodes": [
    {
      "id": "agent-a",
      "connections": 42
    }
  ]
}
```

`29.7s` - [x] Reciprocal access works in both directions

## Beat 4: Constraint Fires


`29.7s` **Agent B (0x19fd...d9cf) attempts unauthorized access to /raw-export**

`29.7s` 403 Forbidden — no permission token for /raw-export

```json
{
  "error": "No permission for /raw-export"
}
```

`29.7s` - [x] Unauthorized endpoint correctly rejected

## Beat 5: Directive Violation + Claim


`29.7s` **Agent B (0x19fd...d9cf) fetches /market-data (legitimate access)**

`29.7s` **Agent B re-publishes market data to /public/board — violates "no redistribution" directive**

`29.7s` Agent A discovers re-published data on public board

```json
{
  "publicUrl": "http://localhost:42070/public/board",
  "postedBy": "0x19fd46b37dae25db22967fc3e32d61be4c52d9cf",
  "redistributedData": {
    "pairs": [
      {
        "base": "ETH",
        "quote": "USD",
        "price": 3500
      }
    ]
  }
}
```

`29.7s` **partyA files claim: Agent B violated no-redistribution directive**

```json
{
  "type": "directive-violation",
  "directive": "Do not re-publish or redistribute received data to third parties",
  "publicUrl": "http://localhost:42070/public/board",
  "redistributedData": {
    "pairs": [
      {
        "base": "ETH",
        "quote": "USD",
        "price": 3500
      }
    ]
  },
  "originalReceipt": {
    "account": "0x19fd46b37dae25db22967fc3e32d61be4c52d9cf",
    "endpoint": "market-data",
    "timestamp": 1773805898450
  }
}
```

`30.8s` - [x] Claim indexed with verdict = null (pending)

`30.8s` - [x] Agreement remains ACTIVE during dispute

## Beat 6: Adjudication


`30.8s` **Adjudicator reviews evidence: Agent B re-published data in violation of no-redistribution directive. Verdict: GUILTY → CLOSE**

```json
{
  "adjudicator": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  "verdict": true,
  "action": "CLOSE",
  "reasoning": "Market data found on public board matches data served under agreement. Directive prohibits redistribution."
}
```

`31.6s` Verdict delivered — agreement CLOSED

```json
{
  "outcome": "ADJUDICATED",
  "claimVerdict": true
}
```

`31.6s` - [x] State = CLOSED, outcome = ADJUDICATED

`31.6s` - [x] Claim verdict = true with CLOSE action

## Beat 7: Resolution


`31.6s` Zone 0xa17f...0690 deactivated

`31.7s` Zone 0x19fd...d9cf deactivated

`31.7s` - [x] All trust zones deactivated — zone hats no longer wearable

## Beat 9: Renegotiation


`31.7s` **partyA proposes new agreement with same structure (post-adjudication renegotiation)**

`33.6s` New agreement created

```json
{
  "agreement": "0xc9F25E9ede7e7Ec2e3f2FA9bADF51caCD3A28551"
}
```

`40.9s` **Drove new agreement through NEGOTIATE → SET_UP → STAKE → ACTIVATE**

`40.9s` New agreement ACTIVE alongside closed predecessor

```json
{
  "agreement #1": "0x96d8...B369 — CLOSED (ADJUDICATED)",
  "agreement #2": "0xc9F2...8551 — ACTIVE"
}
```

`40.9s` - [x] Both agreements indexed independently

`40.9s` - [x] Second agreement fully operational
