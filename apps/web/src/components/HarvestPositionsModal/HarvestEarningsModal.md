# Harvest Earnings Modal — Implementation Document

**Linear**: [PAN-10674 — Harvest Earnings Modal](https://linear.app/pancakeswap/issue/PAN-10674/harvest-earnings-modal)  
**Figma**: [Farms & Liquidity 2026 — Harvest Earnings](https://www.figma.com/design/zoloLFJ9sRlHveJmAIn1M2/%F0%9F%9A%9C-Farms---Liquidity-2026?node-id=2581-219359&m=dev)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Subtickets](#2-subtickets)
3. [Entry Points](#3-entry-points)
4. [Harvesting Logic per Protocol](#4-harvesting-logic-per-protocol)
5. [Can We Combine Calls?](#5-can-we-combine-calls)
6. [EIP-5792 Batch Transactions](#6-eip-5792-batch-transactions)
7. [Recommended Harvest Strategy for EVM](#7-recommended-harvest-strategy-for-evm)
8. [Solana Harvesting](#8-solana-harvesting)
9. [Partial Harvest & Transaction State](#9-partial-harvest--transaction-state)
10. [State Management (Jotai)](#10-state-management-jotai)
11. [Directory Structure](#11-directory-structure)
12. [UI Design](#12-ui-design)
13. [Component Architecture](#13-component-architecture)
14. [Data Flow](#14-data-flow)
15. [Hooks to Reuse](#15-hooks-to-reuse)
16. [Implementation Plan](#16-implementation-plan)

---

## 1. Overview

The Harvest Earnings Modal is a unified modal that lets users harvest **all** of their farming positions across every protocol in a single flow. It consolidates the currently fragmented per-position and per-protocol harvest UIs into one convenient place.

**Key goals:**

- Harvest all EVM positions (Infinity, V3, V2, StableSwap) on the **connected chain** with minimal wallet popups
- Harvest all Solana positions (independent of EVM chain)
- Show real-time transaction status per protocol group (pending, success, failed)
- Support partial harvest — if some protocol transactions succeed and others fail, reflect this accurately with retry capability
- Show total farm earnings in USD in the page header on mobile
- Alert user when they have harvestable positions on other EVM chains, with easy network switching
- Show pre-harvest alert with expected number of wallet confirmations

**What this does NOT do:**

- Collect LP fees (those remain per-position via the existing Collect button)
- This modal only harvests **farm rewards** (e.g., CAKE on EVM, multiple reward tokens on Solana)
- Automatically switch networks to harvest across multiple EVM chains (user must switch manually)

---

## 2. Subtickets


| Ticket                                                      | Title                        | Description                                               |
| ----------------------------------------------------------- | ---------------------------- | --------------------------------------------------------- |
| [PAN-10678](https://linear.app/pancakeswap/issue/PAN-10678) | EVM Positions                | Harvest all EVM farm positions (Infinity + V3 + V2/SS)    |
| [PAN-10679](https://linear.app/pancakeswap/issue/PAN-10679) | Solana Positions             | Harvest all Solana farm positions                         |
| [PAN-10683](https://linear.app/pancakeswap/issue/PAN-10683) | Get Total Earnings           | Compute and display total earnings across all positions   |
| [PAN-10684](https://linear.app/pancakeswap/issue/PAN-10684) | Partial Harvests with Status | Track per-protocol tx status and support retry on failure |


---

## 3. Entry Points

### Desktop — ExpandedRowContent Harvest Button

In `apps/web/src/views/universalFarms/components/PositionsTable/ExpandedRowContent.tsx`, the existing Harvest buttons in `PositionActionButtons` will open this modal instead of harvesting the individual position directly. The button should call a shared `useHarvestEarningsModal()` hook that opens the modal.

### Mobile — Page Header

On `/liquidity/pools` and `/liquidity/positions`, the page header will display the user's total farm earnings in USD. Tapping this earnings display opens the Harvest Earnings Modal.

---

## 4. Harvesting Logic per Protocol

### 4.1 Infinity (EVM) — Single Transaction ✅

**Contract**: Infinity Farming Distributor (`INFI_FARMING_DISTRIBUTOR_ADDRESSES[chainId]`)  
**Method**: `claim(ClaimParams[])`  
**Existing hook**: `useFarmInfinityActions` in `views/universalFarms/hooks/useFarmInfinityActions.tsx`

All Infinity positions (CL + BIN) on a given chain are harvested in **one transaction**. The `claim` function accepts an array of `ClaimParams` (one per reward token, with Merkle proofs), so all unclaimed rewards across all Infinity pools on that chain are batched into a single call.

**Reuse**: The `onHarvest` callback from `useFarmInfinityActions({ chainId })` can be called directly.

### 4.2 V3 (EVM) — Single Transaction via Multicall ✅

**Contract**: MasterChefV3  
**Method**: `harvest(tokenId, to)` batched via `multicall(bytes[])`  
**Existing hook**: `useFarmsV3BatchHarvest` in `views/Farms/hooks/v3/useFarmV3Actions.tsx`

All staked V3 positions can be batch-harvested in **one transaction** using `MasterChefV3.batchHarvestCallParameters()`, which encodes multiple `harvest(tokenId, to)` calls and wraps them in a single `multicall`. This is already implemented and used in the Farms UI.

**Reuse**: The `onHarvestAll(tokenIds)` callback from `useFarmsV3BatchHarvest()` can be called directly with all staked V3 token IDs.

**Important note**: Only positions **staked in MasterChefV3** can be harvested. Unstaked V3 positions earn LP fees (collected via NonfungiblePositionManager) but not farm rewards — they have nothing to harvest.

### 4.3 V2 / StableSwap (EVM) — One Transaction Per Pool ❌

**Contract**: V2SSBCakeWrapper (boosted) or MasterChefV2 (legacy)  
**Method**: `deposit(0, false)` (bCake wrapper) or `deposit(pid, 0)` (MasterChef)  
**Existing hook**: `useV2FarmActions` in `views/universalFarms/hooks/useV2FarmActions.ts`

Each V2/SS position requires a **separate transaction** because:

- Each pool has its own bCakeWrapperAddress
- `deposit(0, false)` is called on the specific wrapper contract per pool
- There is no multicall or batch mechanism across different wrapper contracts

**Reuse**: `useV2FarmActions(lpAddress, bCakeWrapperAddress)` returns `onHarvest()` per pool.

### 4.4 Solana V3 — One Transaction Per Position ❌

**Contract**: Raydium CLMM Program  
**Method**: `decreaseLiquidity` with zero amounts (effectively a harvest)  
**Existing hook**: `useHarvestRewardCallback` in `hooks/solana/useHarvestRewardCallback.tsx`

Each Solana position requires a **separate Solana transaction**. The harvest is performed by calling `raydium.clmm.decreaseLiquidity` with `liquidity: 0` and `amountA/B: "0"`.

**Reuse**: `useHarvestRewardCallback()` returns a callback that accepts `{ poolInfo, position }` per position.

---

## 5. Can We Combine Calls?

### Same-contract batching (already possible)


| Protocol | Batchable? | Mechanism                                            | Transactions          |
| -------- | ---------- | ---------------------------------------------------- | --------------------- |
| Infinity | ✅ Yes      | `claim(ClaimParams[])` — all rewards in one call     | **1 tx** per chain    |
| V3       | ✅ Yes      | `multicall([harvest, harvest, ...])` on MasterChefV3 | **1 tx** per chain    |
| V2/SS    | ❌ No       | Different wrapper contracts per pool                 | **1 tx per pool**     |
| Solana   | ❌ No       | Per-position Raydium CLMM call                       | **1 tx per position** |


### Cross-contract batching (Infinity + V3 + V2/SS in one tx)

**Not possible natively.** Infinity uses the Farming Distributor contract, V3 uses MasterChefV3, and V2/SS uses individual bCake wrapper contracts. There is no shared contract or multicall mechanism that spans all three.

**However**, EIP-5792 can batch them at the wallet level. See [Section 6](#6-eip-5792-batch-transactions).

---

## 6. EIP-5792 Batch Transactions

### What is EIP-5792?

EIP-5792 (`wallet_sendCalls`) allows dApps to send multiple transactions to the wallet as a single batch. If the wallet supports atomic batching (smart accounts), all calls execute in one on-chain transaction. Otherwise, the wallet may execute them sequentially but the user approves them all at once.

### Current Codebase Support

**File**: `apps/web/src/hooks/useIsEIP5792Supported.ts`

The codebase already has full EIP-5792 detection:

- `useIsEIP5792Supported()` — returns `boolean`
- `useEIP5792Status()` — returns `'ready' | 'supported' | 'unsupported'`
  - `ready` = wallet can batch transactions now
  - `supported` = wallet supports it but user needs to upgrade account
  - `unsupported` = wallet does not support batching

**Existing usage**: `useBatchSwapTransaction.ts` uses `sendCalls` and `getCallsStatus` from `viem/experimental` for the Swap flow. We can follow the same pattern.

### Limitations


| Limitation                        | Impact                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Wallet must support EIP-5792      | Most EOA wallets (MetaMask, etc.) do NOT support it yet. Smart wallets (Coinbase Smart Wallet, Safe) do. |
| `atomic.status` must be `'ready'` | If `'supported'`, user rejected or hasn't upgraded. We fall back to sequential.                          |
| Disabled on Base chain            | Current codebase excludes Base from batching (see `useBatchSwapTransaction`).                            |
| Rejection handling                | If user rejects the batch upgrade prompt, we must fall back to sequential popup flow.                    |


### How to Use for Harvest

When EIP-5792 is supported (`status === 'ready'`):

1. Build calldata for each protocol (Infinity `claim`, V3 `multicall`, V2 `deposit`s)
2. Package them as `BatchCall[]` with `{ to, data, value }` for each
3. Send via `client.sendCalls({ calls, forceAtomic: true })`
4. Poll `getCallsStatus` for completion
5. Result: **single wallet popup** for all EVM harvests

When EIP-5792 is NOT supported:

1. Execute each protocol harvest sequentially
2. User gets **one popup per protocol group** (1 for Infinity, 1 for V3, N for V2/SS pools)

---

## 7. Recommended Harvest Strategy for EVM

### "Harvest All" Button Flow

```
User clicks "Harvest All" (EVM panel)
│
├─ Check EIP-5792 support
│  │
│  ├─ SUPPORTED (status === 'ready')
│  │  │
│  │  ├─ Build all calldatas:
│  │  │  ├─ Infinity: encodeClaimCalldata(claimParams)
│  │  │  ├─ V3: MasterChefV3.batchHarvestCallParameters(tokenIds)
│  │  │  └─ V2/SS: deposit(0, false) per wrapper
│  │  │
│  │  ├─ sendCalls({ calls: [...all], forceAtomic: true })
│  │  ├─ Single wallet popup
│  │  └─ Poll getCallsStatus → update state
│  │
│  └─ NOT SUPPORTED
│     │
│     ├─ Execute sequentially (in parallel where safe):
│     │  ├─ [Popup 1] Infinity harvest (1 tx)
│     │  ├─ [Popup 2] V3 batch harvest (1 tx)
│     │  └─ [Popup 3..N] V2/SS harvests (1 tx per pool)
│     │
│     └─ Update state per-protocol as each completes/fails
│
└─ Done: Show final status per protocol card
```

### UX Implications


| Scenario                                | Wallet Popups |
| --------------------------------------- | ------------- |
| EIP-5792 ready, all protocols           | **1 popup**   |
| No EIP-5792, Infinity only              | **1 popup**   |
| No EIP-5792, Infinity + V3              | **2 popups**  |
| No EIP-5792, Infinity + V3 + 2 V2 pools | **4 popups**  |


The modal should display an alert informing the user how many confirmations they'll need **before** they click "Harvest All":

> `"You'll need to confirm X transactions in your wallet"`

This count is deterministic and can be calculated beforehand:
- Check which protocols have harvestable positions on the connected chain
- Check whether EIP-5792 is supported (`useEIP5792Status()`)
- If EIP-5792 ready: count = 1
- If not: count = (1 if Infinity has rewards) + (1 if V3 has staked positions) + (N V2/SS pools with rewards)

Display this as a `Tips` or `Message` component above the "Harvest All" button.

---

## 8. Solana Harvesting

### Flow

Solana operates independently from EVM. The Solana panel:

- Only visible when a Solana wallet is connected
- Has its own "Harvest All" button
- Executes harvests sequentially (one per position)

### Implementation

For each Solana V3 position with pending rewards:

1. Call `useHarvestRewardCallback()` which calls `raydium.clmm.decreaseLiquidity` with zero amounts
2. Each call is a separate Solana transaction requiring wallet approval
3. Update per-position status as each completes

### Data Loading

Solana positions are loaded via existing hooks in the universal farms state. The pool info (`SolanaV3Pool`) and position data (`SolanaV3PositionDetail`) are already available through the position loading hooks.

---

## 9. Partial Harvest & Transaction State

### Requirements (PAN-10684)

When user clicks "Harvest All" and multiple transactions are involved, some may succeed and others may fail. The UI must:

1. Show a **status indicator** per position card (using the same icons as `TransactionListItemV2`):
  - `Pending` — spinner (secondary color background, white spinner)
  - `Success` — green checkmark (`CheckmarkCircleFillIcon`, color `positive60`)
  - `Failed` — warning icon (`ErrorFillIcon`, color `failure`)
  - `PartialSuccess` — warning icon (`ErrorFillIcon`, color `warning`)
2. Show per-protocol group status (e.g., "Infinity: Success", "V3: Failed")
3. **Retry** button appears when any transaction fails:
  - Only retries the failed protocol(s)
  - Already-succeeded protocols remain marked as success
  - Error message shown at bottom: "An error occurred during the harvest of pool #XXXX, please try again"

### State Tracking

Each position/protocol group needs a transaction state tracked via jotai atoms. See [Section 10](#10-state-management-jotai).

### Figma Reference States


| State                 | Figma                                                                                                                                 | Description                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Default               | [node 2581-219359](https://www.figma.com/design/zoloLFJ9sRlHveJmAIn1M2/%F0%9F%9A%9C-Farms---Liquidity-2026?node-id=2581-219359&m=dev) | No harvest in progress, showing positions with earnings |
| Solana harvesting     | [node 2581-219487](https://www.figma.com/design/zoloLFJ9sRlHveJmAIn1M2/%F0%9F%9A%9C-Farms---Liquidity-2026?node-id=2581-219487&m=dev) | Solana transactions ongoing                             |
| EVM 1 tx ongoing      | [node 2581-219625](https://www.figma.com/design/zoloLFJ9sRlHveJmAIn1M2/%F0%9F%9A%9C-Farms---Liquidity-2026?node-id=2581-219625&m=dev) | One EVM protocol harvesting                             |
| Mixed success/pending | [node 2581-219758](https://www.figma.com/design/zoloLFJ9sRlHveJmAIn1M2/%F0%9F%9A%9C-Farms---Liquidity-2026?node-id=2581-219758&m=dev) | Some positions done, some still pending                 |
| Failed with retry     | [node 2581-219895](https://www.figma.com/design/zoloLFJ9sRlHveJmAIn1M2/%F0%9F%9A%9C-Farms---Liquidity-2026?node-id=2581-219895&m=dev) | Some success, one failed, retry button + error message  |


---

## 10. State Management (Jotai)

### Atom Design

State lives in `./HarvestPositionsModal/state/`.

```typescript
// state/atoms.ts
import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

export enum HarvestTxStatus {
  Idle = 'idle',
  Pending = 'pending',
  Success = 'success',
  Failed = 'failed',
}

// Unique key per harvest group: 'infinity-{chainId}', 'v3-{chainId}', 'v2-{lpAddress}', 'solana-{positionKey}'
export const harvestTxStatusAtom = atomFamily(
  (_key: string) => atom<HarvestTxStatus>(HarvestTxStatus.Idle),
)

export const harvestTxHashAtom = atomFamily(
  (_key: string) => atom<string | undefined>(undefined),
)

export const harvestErrorAtom = atomFamily(
  (_key: string) => atom<string | undefined>(undefined),
)

// Derived: overall EVM status
export const evmHarvestStatusAtom = atom((get) => {
  // Reads all registered EVM harvest keys and computes aggregate status
})

// Derived: overall Solana status
export const solanaHarvestStatusAtom = atom((get) => {
  // Reads all registered Solana harvest keys and computes aggregate status
})
```

### Key Naming Convention


| Protocol   | Key Format                 | Example         |
| ---------- | -------------------------- | --------------- |
| Infinity   | `infinity-{chainId}`       | `infinity-56`   |
| V3         | `v3-{chainId}`             | `v3-56`         |
| V2         | `v2-{lpAddress}`           | `v2-0xabc...`   |
| StableSwap | `ss-{lpAddress}`           | `ss-0xdef...`   |
| Solana     | `solana-{positionNftMint}` | `solana-ABC...` |


### Reset

When the modal opens, all atoms should be reset to `Idle`. When modal closes, atoms can remain (user may reopen to see results) but should reset on next "Harvest All" click.

---

## 11. Directory Structure

```
apps/web/src/components/HarvestPositionsModal/
├── index.tsx                          # Main modal component (HarvestEarningsModal)
├── HarvestEarningsModal.md            # This document
├── state/
│   └── atoms.ts                       # Jotai atoms for tx status tracking
├── hooks/
│   ├── useHarvestEarningsModal.ts     # Hook to open/close the modal
│   ├── useEvmHarvestAll.ts            # Orchestrates all EVM harvests (with EIP-5792 support)
│   ├── useSolanaHarvestAll.ts         # Orchestrates all Solana harvests
│   └── useTotalEarnings.ts            # Aggregates total earnings across all protocols
├── shared/
│   ├── PositionCard.tsx               # Position card (LightGreyCard + PreTitle)
│   └── HarvestStatusIndicator.tsx     # Status icon (reuses TransactionStatusV2 icons)
├── EvmHarvestPanel.tsx                # EVM positions panel with "Harvest All" button
└── SolanaHarvestPanel.tsx             # Solana positions panel with "Harvest All" button
```

---

## 12. UI Design

### Modal Layout

```
┌──────────────────────────────────────────────┐
│  Harvest Earnings                          ✕ │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ SOLANA POSITIONS             $999,999.99 ││
│  │                                          ││
│  │  [logos] Token1/Token2 #123      $XX.XX  ││
│  │          X RewardA + Y RewardB           ││
│  │                                          ││
│  │  [logos] Token1/Token2 #456      $XX.XX  ││
│  │          X RewardA + Y RewardB           ││
│  │                                          ││
│  │  ┌──────────────────────────────────┐    ││
│  │  │          Harvest all             │    ││
│  │  └──────────────────────────────────┘    ││
│  └──────────────────────────────────────────┘│
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ EVM POSITIONS (BSC)          $999,999.99 ││
│  │                                          ││
│  │  [✅][logos] Token1/Token2       $XX.XX  ││
│  │              X CAKE                      ││
│  │                                          ││
│  │  [✅][logos] Token1/Token2       $XX.XX  ││
│  │              X CAKE                      ││
│  │                                          ││
│  │  [⚠️][logos] Token1/Token2       $XX.XX  ││
│  │              X CAKE                      ││
│  │                                          ││
│  │  ┌──────────────────────────────────┐    ││
│  │  │ ℹ Confirm 3 transactions         │    ││
│  │  └──────────────────────────────────┘    ││
│  │                                          ││
│  │  ┌──────────────────────────────────┐    ││
│  │  │           Retry                  │    ││
│  │  └──────────────────────────────────┘    ││
│  │                                          ││
│  │  ┌──────────────────────────────────┐    ││
│  │  │ ⚠ An error occurred during the   │    ││
│  │  │   harvest of pool #123,          │    ││
│  │  │   please try again               │    ││
│  │  └──────────────────────────────────┘    ││
│  └──────────────────────────────────────────┘│
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ ℹ You also have earnings on Ethereum,    ││
│  │   Arbitrum. Switch network to harvest.   ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### UI Patterns (from PositionModals)

Follow the patterns established in `apps/web/src/components/PositionModals/`:

- **Modal wrapper**: `ModalV2` + `MotionModal` (width ~480px)
- **Panel cards**: `LightGreyCard` with `padding="16px"` `borderRadius="24px"`
- **Section headers**: `PreTitle` with `color="secondary"` for "SOLANA POSITIONS" / "EVM POSITIONS"
- **USD amounts**: `formatFiatNumber()` for currency display
- **Token amounts**: `formatNumber()` for token amounts
- **Status icons**: Reuse `StatusIndicator` pattern from `TransactionListItemV2`:
  - Pending: `SwapLoading` in secondary-colored circle
  - Success: `CheckmarkCircleFillIcon` color `positive60`
  - Failed: `ErrorFillIcon` color `failure`
  - Partial/Warning: `ErrorFillIcon` color `warning`
- **Buttons**: Full-width `Button` with `variant="secondary"` outline style for "Harvest All"
- **Error banner**: `LightGreyCard` with warning-colored border, `ErrorFillIcon` + error text

### Position Card Layout

Each position card shows **farm rewards only** (no LP fees):

- Double currency logo (token pair)
- `Token1 / Token2` pair name + optional `#tokenId`
- USD value of pending farm rewards (right-aligned)
- Reward token amounts (right-aligned, smaller text):
  - **EVM**: Typically a single reward token (CAKE), displayed as `X CAKE`
  - **Solana**: May have multiple reward tokens, displayed as `X Token1 + Y Token2`
- Status indicator icon (left of logos, only during/after harvest)

---

## 13. Component Architecture

### `HarvestEarningsModal` (index.tsx)

Top-level modal component:

- Uses `ModalV2` + `MotionModal`
- Renders `SolanaHarvestPanel` (conditionally, if Solana wallet connected)
- Renders `EvmHarvestPanel` (always)
- Title: "Harvest Earnings"

### `EvmHarvestPanel`

- Loads all EVM positions with earnings across protocols **on the connected chain**
- Groups by protocol: Infinity, V3, V2, SS
- Shows total EVM earnings in USD for connected chain
- "Harvest All" button triggers `useEvmHarvestAll`
- Shows transaction count alert: "You'll need to confirm X transactions in your wallet"
- Shows per-position status indicators during/after harvest
- Shows "Retry" button if any harvest failed
- Shows error message card when failures occur
- If user has positions on **other chains**, shows a chain-switch alert below the panel:
  > "You also have earnings on Ethereum and Arbitrum. Switch network to harvest."
  
  with chain icons/names as clickable elements that trigger a network switch

### `SolanaHarvestPanel`

- Only rendered when Solana wallet is connected
- Loads all Solana V3 positions with earnings
- Shows total Solana earnings in USD
- "Harvest All" button triggers `useSolanaHarvestAll`
- Shows per-position status indicators

### `shared/PositionCard`

Reusable card for a single position:

- Props: `currency0`, `currency1`, `tokenId?`, `earningsUSD`, `rewards: { currency, amount }[]`, `status?`
- Uses `LightGreyCard` pattern
- Renders `DoubleCurrencyLogo`, pair name, farm reward amounts, and `HarvestStatusIndicator`
- EVM positions typically show a single CAKE reward; Solana positions may show multiple reward tokens

### `shared/HarvestStatusIndicator`

Maps `HarvestTxStatus` → icon, reusing the same icon components and colors as `TransactionListItemV2`:

```typescript
HarvestTxStatus.Idle → null (no icon)
HarvestTxStatus.Pending → <PendingBox><StyledSwapLoading /></PendingBox>
HarvestTxStatus.Success → <CheckmarkCircleFillIcon color="positive60" />
HarvestTxStatus.Failed → <ErrorFillIcon color="failure" />
```

---

## 14. Data Flow

### Loading Earnings Data

```
useTotalEarnings()
├── EVM Earnings (scoped to connected chain)
│   ├── Infinity: useUserAllFarmRewardsByChainIdFromAPI({ chainId, user })
│   │   → totalUnclaimedRewards (CAKE amount + USD)
│   ├── V3: useV3CakeEarning() or useStakedPositionsByUser()
│   │   → pendingCake per tokenId
│   ├── V2: useV2CakeEarning(poolInfo) per pool
│   │   → earningsAmount, earningsBusd
│   └── SS: same as V2 (shared hook)
│
├── EVM Earnings (other chains, for chain-switch alert)
│   └── Lightweight check: do any positions exist with rewards on non-connected chains?
│       → otherChains: { chainId, hasRewards }[]
│
├── Solana Earnings
│   └── Per-position reward data (may include multiple reward tokens per position)
│
└── Returns: { evmPositions[], solanaPositions[], totalUSD, otherChainsWithRewards[] }
```

### Harvest Execution

```
useEvmHarvestAll()
├── Detects EIP-5792 support
├── If supported:
│   ├── Builds calldata array for all protocols
│   ├── sendCalls({ calls }) → single popup
│   └── Polls getCallsStatus → updates atoms
└── If not supported:
    ├── Fires Infinity harvest → updates atom
    ├── Fires V3 batch harvest → updates atom
    └── Fires V2/SS harvests sequentially → updates atoms

useSolanaHarvestAll()
├── For each Solana position:
│   ├── Call useHarvestRewardCallback()
│   └── Update position atom on success/failure
└── Runs sequentially (each needs wallet approval)
```

---

## 15. Hooks to Reuse


| Hook                                    | Location                                                                      | Purpose                                             |
| --------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| `useFarmInfinityActions`                | `views/universalFarms/hooks/useFarmInfinityActions.tsx`                       | Infinity harvest (returns `onHarvest`)              |
| `useFarmsV3BatchHarvest`                | `views/Farms/hooks/v3/useFarmV3Actions.tsx`                                   | V3 batch harvest (returns `onHarvestAll(tokenIds)`) |
| `useV2FarmActions`                      | `views/universalFarms/hooks/useV2FarmActions.ts`                              | V2/SS harvest (returns `onHarvest` per pool)        |
| `useHarvestRewardCallback`              | `hooks/solana/useHarvestRewardCallback.tsx`                                   | Solana per-position harvest                         |
| `useIsEIP5792Supported`                 | `hooks/useIsEIP5792Supported.ts`                                              | EIP-5792 detection                                  |
| `useEIP5792Status`                      | `hooks/useIsEIP5792Supported.ts`                                              | Detailed EIP-5792 status                            |
| `useUserAllFarmRewardsByChainIdFromAPI` | `hooks/infinity/useFarmReward.ts`                                             | Infinity unclaimed rewards data                     |
| `useV2CakeEarning`                      | `views/universalFarms/hooks/useCakeEarning.ts`                                | V2/SS pending CAKE                                  |
| `useCakePrice`                          | `hooks/useCakePrice.ts`                                                       | CAKE price for USD conversion                       |
| `useCatchTxError`                       | `hooks/useCatchTxError.ts`                                                    | Standard tx error handling                          |
| `useLatestTxReceipt`                    | `state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt.ts`            | Trigger position data refresh                       |
| `useAccountV3Positions`                 | `state/farmsV4/state/accountPositions/hooks/useAccountV3Positions.ts`         | All V3 positions                                    |
| `useAccountInfinityCLPositions`         | `state/farmsV4/state/accountPositions/hooks/useAccountInfinityCLPositions.ts` | All Infinity CL positions                           |


---

## 16. Implementation Plan

### Phase 1: Data Layer (PAN-10683)

1. Create `hooks/useTotalEarnings.ts` — aggregate earnings across all protocols
2. Collect all EVM positions with pending farm rewards:
  - Infinity: from `useUserAllFarmRewardsByChainIdFromAPI`
  - V3: from staked positions with pending CAKE > 0
  - V2/SS: from pools where user has staked balance with earnings > 0
3. Collect all Solana positions with pending rewards
4. Compute total USD across everything

### Phase 2: State Layer (PAN-10684)

1. Create `state/atoms.ts` with `HarvestTxStatus` enum and atomFamily atoms
2. Implement status tracking per harvest key
3. Wire up status updates from transaction callbacks

### Phase 3: UI Components

1. Create `shared/PositionCard.tsx` and `shared/HarvestStatusIndicator.tsx`
2. Create `EvmHarvestPanel.tsx` — renders EVM positions grouped by protocol, "Harvest All" button
3. Create `SolanaHarvestPanel.tsx` — renders Solana positions, "Harvest All" button
4. Create `index.tsx` — modal wrapper, conditionally renders panels

### Phase 4: EVM Harvest Execution (PAN-10678)

1. Create `hooks/useEvmHarvestAll.ts`:
  - Check EIP-5792 support
  - **If supported**: build calldata for all protocols, use `sendCalls`
  - **If not supported**: execute sequentially with `useFarmInfinityActions.onHarvest`, `useFarmsV3BatchHarvest.onHarvestAll`, and `useV2FarmActions.onHarvest` per pool
  - Update jotai atoms on each tx success/failure
2. Wire "Harvest All" button → hook
3. Wire "Retry" button → re-execute only failed protocol keys

### Phase 5: Solana Harvest Execution (PAN-10679)

1. Create `hooks/useSolanaHarvestAll.ts`:
  - Iterate all Solana positions with rewards
  - Call `useHarvestRewardCallback` per position sequentially
  - Update jotai atoms per position
2. Wire "Harvest All" button → hook

### Phase 6: Entry Points

1. Modify `ExpandedRowContent.tsx` — Harvest button opens `HarvestEarningsModal`
2. Add total earnings display to mobile page header on `/liquidity/pools` and `/liquidity/positions`
3. Create `hooks/useHarvestEarningsModal.ts` for modal open/close state

### Phase 7: Polish

1. Error messages and retry UX
2. Loading states and skeletons
3. Edge cases: no positions, all zero earnings, wallet disconnected mid-harvest
4. Ensure modal resets properly on close/reopen
5. Chain-switch alert: detect positions with rewards on non-connected chains, render clickable chain names that trigger network switch
6. Transaction count alert: compute and display "You'll need to confirm X transactions" above the Harvest All button

---

## Appendix: Design Decisions

### Multi-chain EVM Harvesting

**Decision**: Harvest only the currently connected EVM chain. Show positions from all chains for visibility, but only enable "Harvest All" for the connected chain. If the user has harvestable positions on other chains, display a chain-switch alert:

> "You also have earnings on [ChainA], [ChainB]. Switch network to harvest."

Chain names are clickable and trigger a network switch. After switching, the modal refreshes to show the new chain's positions as harvestable.

**Rationale**: Automatic sequential chain-switching is fragile (wallets may reject, user confusion) and adds significant complexity. Explicit user-driven switching is clearer.

### Position Card — Farm Rewards Only

**Decision**: Show only farm rewards per position. No LP fees displayed in this modal.

- **EVM positions**: Typically earn a single reward token (CAKE). Display: `X CAKE` + USD value.
- **Solana positions**: May earn multiple reward tokens. Display: `X Token1 + Y Token2` + USD value.

The `0 Token1 + 0 Token2` pattern in the Figma represents reward token amounts, not LP fees.

### Transaction Count Alert

**Decision**: Show a pre-harvest alert informing the user how many wallet confirmations they'll need. Calculated from protocol count and EIP-5792 support. Displayed as a `Tips` component above the "Harvest All" button.