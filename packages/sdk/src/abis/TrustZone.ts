export const TrustZoneABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "fallback",
    "stateMutability": "payable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "accountId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "entryPoint",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IEntryPoint"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "execute",
    "inputs": [
      {
        "name": "mode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "executionCalldata",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "executeFromExecutor",
    "inputs": [
      {
        "name": "mode",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "executionCalldata",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "returnData",
        "type": "bytes[]",
        "internalType": "bytes[]"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "getNonce",
    "inputs": [
      {
        "name": "key",
        "type": "uint192",
        "internalType": "uint192"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getNonce",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hatValidator",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hook",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "hatValidatorAddr",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "hatValidatorInitData",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "agreementExecutor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "executorInitData",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "hookMultiplexer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "hookInitData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "installModule",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "module",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "initData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isModuleInstalled",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "module",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "data",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isValidSignature",
    "inputs": [
      {
        "name": "hash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "supportsExecutionMode",
    "inputs": [
      {
        "name": "encodedMode",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "supportsModule",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "uninstallModule",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "module",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "deInitData",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "validateUserOp",
    "inputs": [
      {
        "name": "userOp",
        "type": "tuple",
        "internalType": "struct PackedUserOperation",
        "components": [
          {
            "name": "sender",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "nonce",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "initCode",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "callData",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "accountGasLimits",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "preVerificationGas",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "gasFees",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "paymasterAndData",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "signature",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "userOpHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "missingAccountFunds",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ERC7579TryExecuteFail",
    "inputs": [
      {
        "name": "batchExecutionIndex",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "returndata",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Initialized",
    "inputs": [
      {
        "name": "version",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ModuleInstalled",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "module",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ModuleUninstalled",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "module",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TrustZoneInitialized",
    "inputs": [
      {
        "name": "hatValidator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "agreementExecutor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "hookMultiplexer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AccountUnauthorized",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "AlreadyInitialized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC7579AlreadyInstalledModule",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "module",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC7579CannotDecodeFallbackData",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC7579DecodingError",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC7579HookModuleAlreadyPresent",
    "inputs": [
      {
        "name": "hook",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC7579MismatchedModuleTypeId",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "module",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC7579MissingFallbackHandler",
    "inputs": [
      {
        "name": "selector",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC7579UninstalledModule",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "module",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC7579UnsupportedCallType",
    "inputs": [
      {
        "name": "callType",
        "type": "bytes1",
        "internalType": "CallType"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC7579UnsupportedExecType",
    "inputs": [
      {
        "name": "execType",
        "type": "bytes1",
        "internalType": "ExecType"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC7579UnsupportedModuleType",
    "inputs": [
      {
        "name": "moduleTypeId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "FailedCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidInitialization",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotInitializing",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OutOfRangeAccess",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  }
] as const;
