import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

export interface ChainClients {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public: PublicClient<Transport, Chain>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wallet: WalletClient<Transport, Chain, Account>;
  account: ReturnType<typeof privateKeyToAccount>;
}

export function createChainClients(
  rpcUrl: string,
  privateKey: Hex,
  chainId?: number,
): ChainClients {
  const chain = chainId === 84532 ? baseSepolia : base;
  const account = privateKeyToAccount(privateKey);

  const pub = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const wallet = createWalletClient({
    chain,
    transport: http(rpcUrl),
    account,
  });

  return {
    public: pub as unknown as ChainClients["public"],
    wallet: wallet as unknown as ChainClients["wallet"],
    account,
  };
}
