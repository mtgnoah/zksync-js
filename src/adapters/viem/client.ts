// src/adapters/viem/client.ts
import type {
  PublicClient,
  WalletClient,
  Account,
  Chain,
  Transport,
  GetContractReturnType,
  Abi,
} from 'viem';
import { getContract, createWalletClient, createPublicClient, http } from 'viem';
import type { ZksRpc } from '../../core/rpc/zks';
import { zksRpcFromViem } from './rpc';

import type { Address } from '../../core/types/primitives'; // ← use your core Address type
import {
  L2_ASSET_ROUTER_ADDRESS,
  L2_NATIVE_TOKEN_VAULT_ADDRESS,
  L2_BASE_TOKEN_ADDRESS,
} from '../../core/constants';

// ABIs from internal snapshot (same as ethers adapter)
import {
  IBridgehubABI,
  IL1AssetRouterABI,
  IL1NullifierABI,
  IL2AssetRouterABI,
  L2NativeTokenVaultABI,
  L1NativeTokenVaultABI,
  IBaseTokenABI,
} from '../../core/abi';

export interface ResolvedAddresses {
  bridgehub: Address;
  l1AssetRouter: Address;
  l1Nullifier: Address;
  l1NativeTokenVault: Address;
  l2AssetRouter: Address;
  l2NativeTokenVault: Address;
  l2BaseTokenSystem: Address;
}

export interface ViemClient {
  readonly kind: 'viem';
  readonly l1: PublicClient;
  readonly l2: PublicClient;
  readonly l1Wallet: WalletClient<Transport, Chain, Account>;
  readonly l2Wallet?: WalletClient<Transport, Chain, Account>;
  readonly account: Account;
  readonly zks: ZksRpc;

  ensureAddresses(): Promise<ResolvedAddresses>;
  getL2Wallet(): WalletClient<Transport, Chain, Account>;
  contracts(): Promise<{
    bridgehub: GetContractReturnType<typeof IBridgehubABI, PublicClient>;
    l1AssetRouter: GetContractReturnType<typeof IL1AssetRouterABI, PublicClient>;
    l1Nullifier: GetContractReturnType<typeof IL1NullifierABI, PublicClient>;
    l1NativeTokenVault: GetContractReturnType<typeof L1NativeTokenVaultABI, PublicClient>;
    l2AssetRouter: GetContractReturnType<typeof IL2AssetRouterABI, PublicClient>;
    l2NativeTokenVault: GetContractReturnType<typeof L2NativeTokenVaultABI, PublicClient>;
    l2BaseTokenSystem: GetContractReturnType<typeof IBaseTokenABI, PublicClient>;
  }>;
  refresh(): void;
  baseToken(chainId: bigint): Promise<Address>;

  /** Chain registry for interop destinations */
  registerChain(chainId: bigint, clientOrUrl: PublicClient | string): void;
  registerChains(map: Record<string, PublicClient | string>): void;
  getPublicClient(chainId: bigint): PublicClient | undefined;
  requirePublicClient(chainId: bigint): PublicClient;
  listChains(): bigint[];

  /** Get a wallet client connected to L1 or a specific L2 */
  walletFor(target?: 'l1' | bigint): WalletClient<Transport, Chain, Account>;
}

type InitArgs = {
  l1: PublicClient;
  l2: PublicClient;
  l1Wallet: WalletClient<Transport, Chain, Account>;
  l2Wallet?: WalletClient<Transport, Chain, Account>;
  /** Optional pre-seeded chain registry (eip155 chainId → PublicClient or RPC URL) for interop destinations */
  chains?: Record<string, PublicClient | string>;
  overrides?: Partial<ResolvedAddresses>;
};

export function createViemClient(args: InitArgs): ViemClient {
  const { l1, l2, l1Wallet, l2Wallet } = args;
  if (!l1Wallet.account) {
    throw new Error('WalletClient must have an account configured.');
  }
  if (l2Wallet && !l2Wallet.account) throw new Error('l2Wallet provided without an account.');

  const zks = zksRpcFromViem(l2);

  let addrCache: ResolvedAddresses | undefined;
  let cCache:
    | {
        bridgehub: GetContractReturnType<typeof IBridgehubABI, PublicClient>;
        l1AssetRouter: GetContractReturnType<typeof IL1AssetRouterABI, PublicClient>;
        l1Nullifier: GetContractReturnType<typeof IL1NullifierABI, PublicClient>;
        l1NativeTokenVault: GetContractReturnType<typeof L1NativeTokenVaultABI, PublicClient>;
        l2AssetRouter: GetContractReturnType<typeof IL2AssetRouterABI, PublicClient>;
        l2NativeTokenVault: GetContractReturnType<typeof L2NativeTokenVaultABI, PublicClient>;
        l2BaseTokenSystem: GetContractReturnType<typeof IBaseTokenABI, PublicClient>;
      }
    | undefined;

  // Chain registry for interop destinations
  const chainMap = new Map<bigint, PublicClient>();

  // Pre-seed chain registry if provided
  if (args.chains) {
    for (const [k, p] of Object.entries(args.chains)) {
      const client =
        typeof p === 'string' ? createPublicClient({ transport: http(p) }) : p;
      chainMap.set(BigInt(k), client);
    }
  }

  async function ensureAddresses(): Promise<ResolvedAddresses> {
    if (addrCache) return addrCache;

    // Bridgehub via zks_getBridgehubContract
    const bridgehub = args.overrides?.bridgehub ?? (await zks.getBridgehubAddress());

    // L1 AssetRouter via Bridgehub.assetRouter()
    const l1AssetRouter =
      args.overrides?.l1AssetRouter ??
      ((await l1.readContract({
        address: bridgehub,
        abi: IBridgehubABI as Abi,
        functionName: 'assetRouter',
      })) as Address);

    // L1Nullifier via L1AssetRouter.L1_NULLIFIER()
    const l1Nullifier =
      args.overrides?.l1Nullifier ??
      ((await l1.readContract({
        address: l1AssetRouter,
        abi: IL1AssetRouterABI as Abi,
        functionName: 'L1_NULLIFIER',
      })) as Address);

    // L1NativeTokenVault via L1Nullifier.l1NativeTokenVault()
    const l1NativeTokenVault =
      args.overrides?.l1NativeTokenVault ??
      ((await l1.readContract({
        address: l1Nullifier,
        abi: IL1NullifierABI as Abi,
        functionName: 'l1NativeTokenVault',
      })) as Address);

    // L2 addresses from constants (overridable)
    const l2AssetRouter = args.overrides?.l2AssetRouter ?? L2_ASSET_ROUTER_ADDRESS;
    const l2NativeTokenVault = args.overrides?.l2NativeTokenVault ?? L2_NATIVE_TOKEN_VAULT_ADDRESS;
    const l2BaseTokenSystem = args.overrides?.l2BaseTokenSystem ?? L2_BASE_TOKEN_ADDRESS;

    addrCache = {
      bridgehub,
      l1AssetRouter,
      l1Nullifier,
      l1NativeTokenVault,
      l2AssetRouter,
      l2NativeTokenVault,
      l2BaseTokenSystem,
    };
    return addrCache;
  }

  async function contracts() {
    if (cCache) return cCache;
    const a = await ensureAddresses();

    cCache = {
      bridgehub: getContract({ address: a.bridgehub, abi: IBridgehubABI, client: l1 }),
      l1AssetRouter: getContract({ address: a.l1AssetRouter, abi: IL1AssetRouterABI, client: l1 }),
      l1Nullifier: getContract({ address: a.l1Nullifier, abi: IL1NullifierABI, client: l1 }),
      l1NativeTokenVault: getContract({
        address: a.l1NativeTokenVault,
        abi: L1NativeTokenVaultABI,
        client: l1,
      }),
      l2AssetRouter: getContract({ address: a.l2AssetRouter, abi: IL2AssetRouterABI, client: l2 }),
      l2NativeTokenVault: getContract({
        address: a.l2NativeTokenVault,
        abi: L2NativeTokenVaultABI,
        client: l2,
      }),
      l2BaseTokenSystem: getContract({
        address: a.l2BaseTokenSystem,
        abi: IBaseTokenABI,
        client: l2,
      }),
    };
    return cCache;
  }

  function refresh() {
    addrCache = undefined;
    cCache = undefined;
  }

  // Chain registry utilities (for interop destinations)
  function registerChain(chainId: bigint, clientOrUrl: PublicClient | string) {
    const client =
      typeof clientOrUrl === 'string' ? createPublicClient({ transport: http(clientOrUrl) }) : clientOrUrl;
    chainMap.set(chainId, client);
  }

  function registerChains(map: Record<string, PublicClient | string>) {
    for (const [k, p] of Object.entries(map)) {
      registerChain(BigInt(k), p);
    }
  }

  function getPublicClient(chainId: bigint) {
    return chainMap.get(chainId);
  }

  function requirePublicClient(chainId: bigint) {
    const p = chainMap.get(chainId);
    if (!p) throw new Error(`No PublicClient registered for destination chainId ${chainId}`);
    return p;
  }

  function listChains(): bigint[] {
    return [...chainMap.keys()];
  }

  // Get a wallet client connected to L1 or a specific L2
  function walletFor(target?: 'l1' | bigint): WalletClient<Transport, Chain, Account> {
    if (target === 'l1') {
      return l1Wallet;
    }
    if (typeof target === 'bigint') {
      const publicClient = requirePublicClient(target);
      return createWalletClient({
        account: l1Wallet.account,
        transport: publicClient.transport as unknown as Transport,
      });
    }
    // Default to l2
    return getL2Wallet();
  }

  async function baseToken(chainId: bigint): Promise<Address> {
    const { bridgehub } = await ensureAddresses();
    const token = (await l1.readContract({
      address: bridgehub,
      abi: IBridgehubABI as Abi,
      functionName: 'baseToken',
      args: [chainId],
    })) as Address;
    return token;
  }

  let lazyL2: WalletClient<Transport, Chain, Account> | undefined;
  function getL2Wallet(): WalletClient<Transport, Chain, Account> {
    if (l2Wallet) return l2Wallet;
    if (!lazyL2) {
      lazyL2 = createWalletClient({
        account: l1Wallet.account,
        transport: l2.transport as unknown as Transport,
      });
    }
    return lazyL2;
  }

  return {
    kind: 'viem',
    l1,
    l2,
    l1Wallet,
    l2Wallet,
    account: l1Wallet.account,
    zks,
    ensureAddresses,
    contracts,
    refresh,
    baseToken,
    getL2Wallet,
    registerChain,
    registerChains,
    getPublicClient,
    requirePublicClient,
    listChains,
    walletFor,
  };
}

export type { InitArgs as ViemClientInit };
