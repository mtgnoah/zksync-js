# Aave L1 Interop Examples

This directory contains reference implementations showing how to use the ZKsync SDK to interact with Aave on Ethereum L1 from an L2 chain.

## How L1 Interop Works

L1 Interop allows users on ZKsync L2 to execute transactions on Ethereum L1 without bridging funds manually. Here's what happens under the hood:

### The Two-Transaction Flow

When you call `sdk.l1.bundle().call(...).create()`, the SDK executes **two transactions**:

1. **Withdrawal Transaction**: A regular L2→L1 withdrawal that sends ETH to your **Shadow Account** on L1. This uses the SDK's `withdrawals.create()` method internally. The withdrawal provides the funds needed to execute your L1 operations.

2. **Bundle Submission Transaction**: A transaction to the **L2 Interop Center** contract that contains instructions for what to execute on L1. This calls `sendBundleToL1()` with an array of operations (target address, value, and encoded calldata for each call).

### Shadow Accounts

A **Shadow Account** is a smart contract wallet on L1 that is controlled by your L2 address. Key points:

- Each L2 address has a deterministic Shadow Account address on L1
- The Shadow Account is deployed automatically when your first bundle is executed
- You can get your Shadow Account address via `sdk.l1.getShadowAccount(yourL2Address)`
- The Shadow Account executes operations on your behalf (e.g., calling Aave contracts)

### Execution Flow

```
L2 User Signs Transactions
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Transaction 1: Withdrawal                                   │
│  - Withdraws ETH from L2 to Shadow Account on L1            │
│  - Uses sdk.withdrawals.create() internally                  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Transaction 2: Bundle Submission                            │
│  - Calls L2InteropCenter.sendBundleToL1()                   │
│  - Contains array of L1 operations to execute               │
│  - Each operation: { target, value, data }                  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
    ~15 min wait (L2→L1 finalization)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  L1 Execution (by operator/relayer)                          │
│  - Proves the L2 messages on L1                             │
│  - Deploys Shadow Account if needed                         │
│  - Executes all operations in the bundle                    │
│  - E.g., calls Aave's depositETH with the withdrawn funds   │
└─────────────────────────────────────────────────────────────┘
```

### Bundle Operations

Each operation in a bundle is an object with:
- `target`: The L1 contract address to call (e.g., Aave WethGateway)
- `value`: Amount of ETH to send with the call
- `data`: Encoded function calldata (the SDK encodes this from ABI + args)

For example, an Aave deposit bundle contains one operation:
```typescript
{
  target: WETH_GATEWAY_ADDRESS,
  value: depositAmount,  // ETH to deposit
  data: encodeFunctionData({
    abi: WethGatewayABI,
    functionName: 'depositETH',
    args: [poolAddress, shadowAccount, 0]
  })
}
```

## Example: Supplying ETH to Aave

Here's what happens when you deposit ETH to Aave:

```typescript
import { aaveDeposit } from './deposit';

// This creates and submits both transactions
const handle = await aaveDeposit(sdk, {
  asset: 'ETH',
  amount: parseEther('1'),
});

// Wait for L1 execution (~15 min)
const result = await handle.wait();
```

Under the hood:

1. **Transaction 1 (Withdrawal)**: Withdraws 1 ETH + gas buffer from L2 to your Shadow Account on L1

2. **Transaction 2 (Bundle)**: Submits a bundle to L2InteropCenter with one operation:
   - Target: Aave WethGateway contract
   - Value: 1 ETH
   - Data: Encoded `depositETH(pool, shadowAccount, 0)` call

3. **L1 Execution**: After ~15 minutes, an operator:
   - Proves the withdrawal and bundle on L1
   - Deploys your Shadow Account if it doesn't exist
   - Shadow Account calls WethGateway.depositETH with 1 ETH
   - You now have aWETH in your Shadow Account on L1

## Example: Borrowing from Aave

Borrowing requires collateral already deposited. The bundle calls Aave's borrow function:

```typescript
import { aaveBorrow, INTEREST_RATE_MODE } from './borrow';

const handle = await aaveBorrow(sdk, {
  asset: 'USDC',
  amount: parseUnits('1000', 6),
  interestRateMode: INTEREST_RATE_MODE.VARIABLE,
});
```

The bundle contains one operation calling `Pool.borrow()`. The borrowed tokens end up in your Shadow Account.

## Example: Multi-Operation Bundles

You can chain multiple operations in a single bundle. For example, depositing an ERC20 requires approve + supply:

```typescript
const handle = await sdk.l1.bundle()
  // Operation 1: Approve Pool to spend USDC
  .call({
    target: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'approve',
    args: [AAVE_POOL, amount],
  })
  // Operation 2: Supply USDC to Aave
  .call({
    target: AAVE_POOL,
    abi: aavePoolAbi,
    functionName: 'supply',
    args: [USDC_ADDRESS, amount, shadowAccount, 0],
  })
  .create();
```

Both operations execute atomically in a single L1 transaction.

## ETH vs ERC20 Handling

The examples handle ETH and ERC20 tokens differently:

**ETH Operations** use the WethGateway contract:
- `depositETH` - payable, sends ETH with the call
- `withdrawETH` - requires aWETH approval first
- `borrowETH` - borrows and unwraps WETH to ETH
- `repayETH` - payable, sends ETH to repay debt

**ERC20 Operations** use the Pool contract with approve steps:
- `supply` - requires token approval to Pool first
- `withdraw` - no approval needed
- `borrow` - no approval needed
- `repay` - requires token approval to Pool first

## Getting Quotes

Before executing, you can get a quote to see the estimated costs:

```typescript
const quote = await aaveDepositQuote(sdk, {
  asset: 'ETH',
  amount: parseEther('1'),
});

console.log('Required funds:', quote.requiredFunds);
console.log('Current Shadow Account balance:', quote.currentBalance);
console.log('Amount to bridge from L2:', quote.bridgeAmount);
console.log('Estimated L1 gas:', quote.estimatedGas);
console.log('Total cost:', quote.totalCost);
```

## Files

- `constants.ts` - Aave contract addresses and ABIs for mainnet/testnet
- `deposit.ts` - Deposit (supply) collateral to Aave
- `borrow.ts` - Borrow assets from Aave
- `withdraw.ts` - Withdraw assets from Aave
- `repay.ts` - Repay borrowed assets

## Important Notes

1. **Finalization Time**: L1 execution happens ~15 minutes after bundle submission (L2 finalization window)

2. **Shadow Account Persistence**: Your Shadow Account persists on L1. Deposited aTokens, borrowed debt, etc. all remain in the Shadow Account

3. **Gas Estimation**: The SDK estimates L1 gas via simulation. A 20% buffer is added for safety since gas prices may change during the finalization window

4. **Funds in Shadow Account**: After operations complete, any remaining funds stay in your Shadow Account. You can use them for future L1 operations or bridge them back to L2
