# InfinityBinPositionAdd — Implementation Draft

## Objective

Implement the missing **Add Liquidity** tab for **InfinityBin** positions inside the Position Management modal (`PositionModals/Infinity/Add/`). This is the only protocol in the Position Modals that lacks an Add implementation.

## Figma Reference

[Figma Design](https://www.figma.com/design/zoloLFJ9sRlHveJmAIn1M2/%F0%9F%9A%9C-Farms---Liquidity-2026?node-id=4579-91747&m=dev)

The design shows these sections (top to bottom):

1. **Price Range (Min-Max)** — Read-only display of the existing position's bin range with a progress bar showing current price position, plus "Current Price" with invert toggle
2. **Distribution** — Read-only display of current position token balances and percentage distribution, fee tier
3. **Set Price Range** — Editable Min Price / Max Price inputs with +/- buttons and NUM BIN input
4. **Choose Liquidity Shape** — Spot / Curve / Bid-Ask shape picker with "Learn more" link
5. **Amount of Liquidity to Add** — Slippage tolerance, two currency input panels (with balance, max, USD), total deposit value (USD)
6. **Add** button

---

## File Structure

```
PositionModals/Infinity/Add/
├── index.tsx                         # InfinityCLPositionAdd (existing)
└── InfinityBinPositionAdd.tsx        # NEW — InfinityBinPositionAdd
```

One new file: `InfinityBinPositionAdd.tsx`

Plus two modifications:
- `PositionModals/Infinity/index.tsx` — Wire up the new component for the `Add` + `InfinityBIN` branch
- `PositionModals/index.tsx` — Remove the `TODO: StableSwap, InfinityBin` comment

---

## Component Design

### Props

```typescript
interface InfinityBinPositionAddProps {
  position: InfinityBinPositionDetail
  poolInfo: PoolInfo
}
```

Follows the same pattern as `InfinityBinPositionRemove` and `InfinityCLPositionAdd`.

### Data Flow

```
position (prop)  →  pool (usePoolById)  →  poolKey (usePoolKeyByPoolId or position.poolKey)
                                        →  currency0, currency1 (from pool)
                                        →  activeId, binStep (from pool)

Local state:
  - lowerBinId, upperBinId (local useState, NOT useBinRangeQueryState)
  - liquidityShape (local useState, NOT useLiquidityShapeQueryState)
  - numBins (derived: upperBinId - lowerBinId + 1)
  - inputValue0, inputValue1 (local useState for amount strings)
  - depositAmount0, depositAmount1 (parsed CurrencyAmount)
  - inverted (local useState)

Permits/Approvals:
  - usePermit2 for token0
  - usePermit2 for token1

Submit:
  - useAddBinLiquidity hook → addBinLiquidity call
```

### Why Local State (not shared URL query state)

The existing Add Liquidity page uses `nuqs` URL query state atoms (`useBinRangeQueryState`, `useLiquidityShapeQueryState`, `useBinNumQueryState`) and hooks that call `useInfinityPoolIdRouteParams()`. These are **router-dependent** and cannot be used inside a modal without side effects to the URL.

Following the pattern set by `InfinityCLPositionAdd` — which uses entirely local state and doesn't rely on route params — the Bin Add modal will manage its own state locally.

---

## Reusable Code Matrix

### Direct Reuse (import as-is)

| Component/Hook | Source | Usage |
|---|---|---|
| `usePoolById` | `hooks/infinity/usePool` | Fetch Bin pool by poolId + chainId |
| `usePoolKeyByPoolId` | `hooks/infinity/usePoolKeyByPoolId` | Get PoolKey for tx params |
| `useAddBinLiquidity` | `views/CreateLiquidityPool/hooks/useAddBinLiquidity` | Execute add bin liquidity tx |
| `usePermit2` | `hooks/usePermit2` | Token approvals |
| `useCurrencyUsdPrice` | `hooks/useCurrencyUsdPrice` | USD prices for total value |
| `useLiquidityUserSlippage` | `@pancakeswap/utils/user` | Slippage tolerance |
| `useTransactionDeadline` | `hooks/useTransactionDeadline` | Tx deadline |
| `useUserSlippagePercent` | `@pancakeswap/utils/user` | For idSlippage calculation |
| `CurrencyInputPanelSimplify` | `components/CurrencyInputPanelSimplify` | Token amount inputs |
| `V3SubmitButton` | `views/AddLiquidityV3/components/V3SubmitButton` | Approve + submit button |
| `LiquiditySlippageButton` | `views/Swap/components/SlippageButton` | Slippage setting |
| `MevProtectToggle` | `views/Mev/MevProtectToggle` | MEV protection |
| `BinRangeSelector` | `components/Liquidity/Form/BinRangeSelector` | Min/Max price + Num Bins |
| `FieldLiquidityShape` | `components/Liquidity/Form/FieldLiquidityShape` | Liquidity shape picker |
| `LightGreyCard` | `@pancakeswap/widgets-internal` | Card container |
| `ApprovalState` | `hooks/useApproveCallback` | Approval state enum |
| `getInfinityPositionManagerAddress` | `utils/addressHelpers` | Position manager address |
| `calculateSlippageAmount` | `utils/exchange` | Slippage amount calc |
| `getIdSlippage` | `@pancakeswap/infinity-sdk` | Bin ID slippage |
| `getCurrencyPriceFromId` | `@pancakeswap/infinity-sdk` | Bin ID → price conversion |
| `useErrorMsg` | `views/IncreaseLiquidity/hooks/useErrorMsg` | Balance validation |
| `BigNumber (bignumber.js)` | `bignumber.js` | USD calculations |

### Cannot Directly Reuse (route-dependent)

| Hook | Why Not | Replacement |
|---|---|---|
| `useAddDepositAmounts` (Bin branch) | Calls `usePool()` which calls `useInfinityPoolIdRouteParams()` | Inline local state management (copy the Bin deposit logic) |
| `useAddDepositAmountsEnabled` | Same route dependency | Inline with local state |
| `useAddFormSubmitEnabled` | Same route dependency | Inline Bin-specific validation |
| `useAddFormSubmitCallback` | Same route dependency, handles redirect | Inline submit logic for modal context |
| `useBinIdRange` | Route-dependent | Pass `maxBinId`/`minBinId` from position or compute locally |
| `usePoolActivePrice` | Route-dependent | Compute from pool.activeId directly |

---

## Section-by-Section Implementation

### Section 1: Price Range (Min-Max) — Read-only

Display the existing position's bin range as prices.

```tsx
<LightGreyCard borderRadius="24px" padding="16px">
  <PreTitle mb="8px">{t('Price Range (Min-Max)')}</PreTitle>
  {/* 
    Use getCurrencyPriceFromId to convert position.minBinId and position.maxBinId
    to prices. Show a PriceRangeDisplay similar to InfinityCLPositionAdd, or
    a simpler custom display showing min price, max price, progress bar.
  */}
  <BinPriceRangeDisplay
    minBinId={position.minBinId}
    maxBinId={position.maxBinId}
    activeId={pool.activeId}
    binStep={pool.binStep}
    currency0={currency0}
    currency1={currency1}
    inverted={inverted}
  />
  <RowBetween mt="8px">
    <Text color="textSubtle" small>{t('Current Price')}</Text>
    <FlexGap gap="2px">
      <Text small>{currentPriceFormatted}</Text>
      <Text color="textSubtle" small>
        {t('%symbol0% per %symbol1%', { symbol0, symbol1 })}
      </Text>
      <IconButton variant="text" onClick={toggleInverted} scale="xs">
        <SwapHorizIcon color="primary60" width="16px" mt="2px" />
      </IconButton>
    </FlexGap>
  </RowBetween>
</LightGreyCard>
```

To render the progress bar showing current price position within the range, compute:
```typescript
const progressPercent = useMemo(() => {
  if (!position.minBinId || !position.maxBinId || !pool) return 50
  const range = position.maxBinId - position.minBinId
  if (range === 0) return 50
  return Math.min(100, Math.max(0,
    ((pool.activeId - position.minBinId) / range) * 100
  ))
}, [position.minBinId, position.maxBinId, pool])
```

Use `getCurrencyPriceFromId` from `@pancakeswap/infinity-sdk` to convert bin IDs to display prices, respecting the `inverted` flag.

### Section 2: Distribution — Read-only

Display current position token amounts and percentages.

```tsx
<LightGreyCard borderRadius="24px" padding="16px" mt="16px">
  <RowBetween>
    <PreTitle>{t('Distribution')}</PreTitle>
    <PreTitle>
      {t('Fee Tier')} {feePercent}
    </PreTitle>
  </RowBetween>
  {/* Token 0 row */}
  <RowBetween mt="12px">
    <FlexGap gap="8px" alignItems="center">
      <CurrencyLogo currency={currency0} size="24px" />
      <Text bold>{currency0?.symbol}</Text>
    </FlexGap>
    <FlexGap gap="8px" alignItems="center">
      <CurrencyLogo currency={currency1} size="24px" />
      <Text bold>{currency1?.symbol}</Text>
    </FlexGap>
  </RowBetween>
  <RowBetween mt="4px">
    <Text>{reserve0Formatted}</Text>
    <Text>{reserve1Formatted}</Text>
  </RowBetween>
  {/* Percentage bar */}
  <Box mt="8px" height="8px" bg="cardBorder" borderRadius="4px" overflow="hidden">
    <Box height="100%" width={`${percent0}%`} bg="secondary" borderRadius="4px" />
  </Box>
  <RowBetween mt="4px">
    <Text small color="textSubtle">{percent0Formatted}%</Text>
    <Text small color="textSubtle">{percent1Formatted}%</Text>
  </RowBetween>
</LightGreyCard>
```

Compute percentages from the position's `reserveX`, `reserveY` and their USD values.

### Section 3: Set Price Range — Interactive

Reuse the existing `BinRangeSelector` component from `components/Liquidity/Form/BinRangeSelector`.

**Caveat**: `BinRangeSelector` internally uses `useBinRangeQueryState()` (URL state) and `useBinPriceRangeCallback`. Since these depend on URL query params, one of these approaches:

**Option A (Recommended)**: Pre-populate the URL query state via `useBinRangeQueryState` setter when the modal opens. This lets `BinRangeSelector` work as-is. The CL Add modal already sets URL state indirectly through hooks. We would call:
```typescript
const [, setBinRange] = useBinRangeQueryState()
useEffect(() => {
  if (position.minBinId && position.maxBinId) {
    setBinRange({ lowerBinId: position.minBinId, upperBinId: position.maxBinId })
  }
}, [position.minBinId, position.maxBinId])
```

Note: `useBinRangeQueryState` does work without route params — it reads/writes `lowerBinId`/`upperBinId` URL params directly. `BinRangeSelector` does NOT depend on `useInfinityPoolIdRouteParams`.

Similarly, `FieldLiquidityShape` uses `useLiquidityShapeQueryState` which also works independently of route params.

**Option B**: Create wrapper components with local state. More isolated but more code duplication.

**Recommendation: Option A.** `BinRangeSelector` and `FieldLiquidityShape` both use shared query state atoms that are independent of the pool route. The Remove modal already uses `useBinRangeQueryState` successfully (see `InfinityBinPositionRemove`). We should follow the same approach, initializing the bin range from the position data on mount.

```tsx
<PreTitle mt="16px">{t('Set Price Range')}</PreTitle>
<Box mt="8px">
  <BinRangeSelector
    currency0={currency0}
    currency1={currency1}
    binStep={pool.binStep}
    activeBinId={pool.activeId}
    minBinId={minBinId}
    maxBinId={maxBinId}
  />
</Box>
```

Where `minBinId`/`maxBinId` come from a range helper — we should compute the full allowed range (not the position's range) using the same logic as `useBinIdRange`:

```typescript
const MAX_BIN_NUM_PER_SIDE = 500
const minBinId = Math.max(1, pool.activeId - MAX_BIN_NUM_PER_SIDE)
const maxBinId = Math.min(Number(maxUint24) - 1, pool.activeId + MAX_BIN_NUM_PER_SIDE)
```

### Section 4: Choose Liquidity Shape — Interactive

Direct reuse of `FieldLiquidityShape`:

```tsx
<FieldLiquidityShape mt="16px" />
```

This component uses `useLiquidityShapeQueryState` internally — works fine in modal context.

### Section 5: Amount of Liquidity to Add — Interactive

Follow `InfinityCLPositionAdd` pattern with `CurrencyInputPanelSimplify`:

```tsx
<PreTitle mt="16px">{t('Amount of Liquidity to Add')}</PreTitle>
<RowBetween mt="8px">
  <Text color="textSubtle" small>{t('Slippage Tolerance')}</Text>
  <LiquiditySlippageButton />
</RowBetween>

<LightGreyCard mt="16px" borderRadius="24px" padding="16px">
  <CurrencyInputPanelSimplify
    id="position-modal-bin-increase-A"
    defaultValue={inputValue0}
    currency={currency0}
    onUserInput={handleAmount0Change}
    onPercentInput={handlePercent0Change}
    showUSDPrice
    showMaxButton
    disableCurrencySelect
    title={<>&nbsp;</>}
    wrapperProps={{ style: { backgroundColor: 'transparent' } }}
  />
  <br />
  <CurrencyInputPanelSimplify
    id="position-modal-bin-increase-B"
    defaultValue={inputValue1}
    currency={currency1}
    onUserInput={handleAmount1Change}
    onPercentInput={handlePercent1Change}
    showUSDPrice
    showMaxButton
    disableCurrencySelect
    title={<>&nbsp;</>}
    wrapperProps={{ style: { backgroundColor: 'transparent' } }}
  />
</LightGreyCard>

<RowBetween mt="16px">
  <Text color="textSubtle" small>{t('Total deposit value (USD):')}</Text>
  <Text small>${totalDepositUsdValue}</Text>
</RowBetween>
```

**Amount state management** (adapted from `useBinDepositAmounts`):

For Bin pools, amounts are independent per token (no ratio constraint like CL). Use simple local state:

```typescript
const [inputValue0, setInputValue0] = useState('')
const [inputValue1, setInputValue1] = useState('')

const depositAmount0 = useMemo(() => {
  if (!currency0 || !inputValue0) return undefined
  try {
    return CurrencyAmount.fromRawAmount(currency0, parseUnits(inputValue0, currency0.decimals))
  } catch { return undefined }
}, [currency0, inputValue0])

const depositAmount1 = useMemo(() => {
  if (!currency1 || !inputValue1) return undefined
  try {
    return CurrencyAmount.fromRawAmount(currency1, parseUnits(inputValue1, currency1.decimals))
  } catch { return undefined }
}, [currency1, inputValue1])
```

Handle percentage/max using `useCurrencyBalances` pattern:
```typescript
const [balance0, balance1] = useCurrencyBalancesWithChain(account, [currency0, currency1], chainId)

const handlePercent0Change = useCallback((percent: number) => {
  if (balance0) {
    setInputValue0(balance0.multiply(new Percent(percent, 100)).toExact())
  }
}, [balance0])
```

### Section 6: Submit Button

Use `V3SubmitButton` with `usePermit2` for both tokens, following `InfinityCLPositionAdd` pattern:

```typescript
const {
  requirePermit: requirePermitA, requireApprove: requireApproveA,
  permit2Allowance: currentAllowanceA, isApproving: isApprovingA,
  permit: permitCallbackA, revoke: revokeCallbackA, approve: approveCallbackA,
} = usePermit2(
  currency0?.isNative ? undefined : depositAmount0?.wrapped,
  getInfinityPositionManagerAddress('Bin', chainId),
  { overrideChainId: chainId },
)

// ... same for token B

const { addBinLiquidity, attemptingTx } = useAddBinLiquidity(
  chainId, account, currency0Address, currency1Address
)
```

### Submit Handler

```typescript
const handleAddLiquidity = useCallback(async () => {
  if (!pool || !account || !poolKey || !currency0 || !currency1) return
  if (!depositAmount0?.greaterThan(0) && !depositAmount1?.greaterThan(0)) return

  let permit2Sig0: Permit2Signature | undefined
  let permit2Sig1: Permit2Signature | undefined

  if (!currency0.isNative && requirePermitA) permit2Sig0 = await permitCallbackA()
  if (!currency1.isNative && requirePermitB) permit2Sig1 = await permitCallbackB()

  const [, amount0Max] = depositAmount0
    ? calculateSlippageAmount(depositAmount0, allowedSlippage) : [0n, maxUint128]
  const [, amount1Max] = depositAmount1
    ? calculateSlippageAmount(depositAmount1, allowedSlippage) : [0n, maxUint128]

  const idSlippage = getIdSlippage(
    parseFloat(userSlippagePercent.toSignificant(2)),
    pool.binStep,
    pool.activeId,
  )

  await addBinLiquidity({
    poolKey,
    liquidityShape: liquidityShape as BinLiquidityShape,
    binNums: numBins,
    activeIdDesired: pool.activeId,
    idSlippage: BigInt(idSlippage),
    amount0Desired: depositAmount0?.quotient ?? 0n,
    amount1Desired: depositAmount1?.quotient ?? 0n,
    amount0Max,
    amount1Max,
    recipient: account,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 20),
    currency0,
    currency1,
    lowerBinId,
    upperBinId,
    token0Permit2Signature: permit2Sig0,
    token1Permit2Signature: permit2Sig1,
  })
}, [/* deps */])
```

---

## Validation Logic

Adapted from `useAddFormSubmitEnabled` (Bin path only):

```typescript
const { errorMessage } = useErrorMsg({
  currencyA: currency0,
  currencyB: currency1,
  currencyAAmount: isDeposit0Enabled ? depositAmount0 : undefined,
  currencyBAmount: isDeposit1Enabled ? depositAmount1 : undefined,
  allowSingleSide: true, // Bin always allows single-sided
})

const invalidBinRange = useMemo(() => {
  if (!lowerBinId || !upperBinId) return true
  if (lowerBinId > upperBinId) return true
  if (lowerBinId < minBinId || lowerBinId > maxBinId) return true
  if (upperBinId < minBinId || upperBinId > maxBinId) return true
  return false
}, [lowerBinId, upperBinId, minBinId, maxBinId])

const outOfRange = useMemo(() => {
  return Boolean(lowerBinId && upperBinId && pool &&
    (pool.activeId < lowerBinId || pool.activeId > upperBinId))
}, [lowerBinId, upperBinId, pool])

// Deposit enabled per token (single-sided support)
const isDeposit0Enabled = useMemo(() => {
  return Boolean(lowerBinId && pool && (lowerBinId >= pool.activeId || isInRange))
}, [lowerBinId, pool])

const isDeposit1Enabled = useMemo(() => {
  return Boolean(upperBinId && pool && (upperBinId <= pool.activeId || isInRange))
}, [upperBinId, pool])

const isValid = !errorMessage && !invalidBinRange
```

---

## Wiring Into the Modal

### `PositionModals/Infinity/index.tsx`

Add import and branch for `InfinityBinPositionAdd`:

```typescript
import { InfinityBinPositionAdd } from './Add/InfinityBinPositionAdd'

// In the render, add before the Remove branches:
{tab === 'Add' && poolInfo.protocol === Protocol.InfinityCLAMM ? (
  <InfinityCLPositionAdd position={...} poolInfo={poolInfo} />
) : tab === 'Add' && poolInfo.protocol === Protocol.InfinityBIN ? (
  <InfinityBinPositionAdd position={position as InfinityBinPositionDetail} poolInfo={poolInfo} />
) : tab === 'Remove' && ...}
```

### `PositionModals/index.tsx`

Remove the TODO comment on line 176:
```diff
-        {/* TODO: StableSwap, InfinityBin */}
```

---

## Complete Import List for InfinityBinPositionAdd.tsx

```typescript
import { BinLiquidityShape, getCurrencyPriceFromId, getIdSlippage, Permit2Signature, PoolKey } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount, Percent } from '@pancakeswap/swap-sdk-core'
import {
  Box, FlexGap, IconButton, PreTitle, RowBetween, SwapHorizIcon, Text,
} from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage, useUserSlippagePercent } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { BigNumber as BN } from 'bignumber.js'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { BinRangeSelector } from 'components/Liquidity/Form/BinRangeSelector'
import { FieldLiquidityShape } from 'components/Liquidity/Form/FieldLiquidityShape'
import { usePoolById } from 'hooks/infinity/usePool'
import { usePoolKeyByPoolId } from 'hooks/infinity/usePoolKeyByPoolId'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { ApprovalState } from 'hooks/useApproveCallback'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { usePermit2 } from 'hooks/usePermit2'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { InfinityBinPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useBinRangeQueryState, useLiquidityShapeQueryState } from 'state/infinity/shared'
import { getInfinityPositionManagerAddress } from 'utils/addressHelpers'
import { calculateSlippageAmount } from 'utils/exchange'
import { CurrencyField } from 'utils/types'
import { V3SubmitButton } from 'views/AddLiquidityV3/components/V3SubmitButton'
import { AddBinLiquidityParams, useAddBinLiquidity } from 'views/CreateLiquidityPool/hooks/useAddBinLiquidity'
import { useErrorMsg } from 'views/IncreaseLiquidity/hooks/useErrorMsg'
import { MevProtectToggle } from 'views/Mev/MevProtectToggle'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { maxUint128, maxUint24, zeroAddress } from 'viem'
import { parseUnits } from 'viem/utils'
import { CurrencyLogo } from 'components/Logo'
```

---

## Component Skeleton

```tsx
export const InfinityBinPositionAdd = ({ position, poolInfo }: InfinityBinPositionAddProps) => {
  const { t } = useTranslation()
  const { account, chainId: activeChainId } = useAccountActiveChain()
  const chainId = position.chainId ?? poolInfo.chainId

  // ── Pool Data ──
  const [, pool] = usePoolById<'Bin'>(position.poolId, chainId)
  const poolKeyResult = usePoolKeyByPoolId(position.poolId, chainId, 'Bin')
  const poolKey = (position.poolKey ?? poolKeyResult?.data) as PoolKey<'Bin'> | undefined
  const currency0 = pool?.token0
  const currency1 = pool?.token1

  // ── Price Display (read-only) ──
  const [inverted, setInverted] = useState(false)
  // ... getCurrencyPriceFromId for min/max/current prices

  // ── Bin Range State ──
  const [, setBinRange] = useBinRangeQueryState()
  const [{ lowerBinId, upperBinId }] = useBinRangeQueryState()
  useEffect(() => { /* init bin range from position */ }, [])

  const MAX_BIN_NUM_PER_SIDE = 500
  const minBinId = /* ... */
  const maxBinId = /* ... */
  const numBins = /* derived */

  // ── Liquidity Shape ──
  const [liquidityShape] = useLiquidityShapeQueryState()

  // ── Deposit Amounts ──
  const [inputValue0, setInputValue0] = useState('')
  const [inputValue1, setInputValue1] = useState('')
  // ... parse to CurrencyAmount

  // ── USD Values ──
  // ... useCurrencyUsdPrice + BN math

  // ── Validation ──
  // ... useErrorMsg, invalidBinRange, outOfRange, isDeposit0/1Enabled

  // ── Token Approvals ──
  // ... usePermit2 x2

  // ── Submit ──
  const { addBinLiquidity, attemptingTx } = useAddBinLiquidity(...)
  const handleAddLiquidity = useCallback(async () => { /* ... */ }, [])

  if (!pool) return null

  return (
    <Box>
      {/* Section 1: Price Range (Min-Max) — read-only */}
      {/* Section 2: Distribution — read-only */}
      {/* Section 3: Set Price Range — BinRangeSelector */}
      {/* Section 4: Choose Liquidity Shape — FieldLiquidityShape */}
      {/* Section 5: Amount Inputs */}
      {/* Section 6: Submit — V3SubmitButton */}
    </Box>
  )
}
```

---

## Key Design Decisions

### 1. BinRangeSelector + FieldLiquidityShape reuse via shared query state

Both components use `nuqs` URL query state, not route params. `InfinityBinPositionRemove` already proves this works in a modal context (it uses `useBinRangeQueryState`). We initialize the shared state from position data on mount.

### 2. Amounts are independent (not ratio-locked)

Unlike CL positions where amounts are derived from one input, Bin pools allow independent amounts for each token. This simplifies the input handling to simple `useState` strings parsed into `CurrencyAmount`.

### 3. Position distribution display

Compute from `position.reserveX` / `position.reserveY` and USD prices. This is purely informational.

### 4. `useAddBinLiquidity` handles confirmation modals internally

The hook already shows a pending confirmation modal and error modal. No need to add custom confirmation UI.

### 5. V3SubmitButton handles approvals and network check

Reuse the same approval + submit button pattern as `InfinityCLPositionAdd`.

---

## Estimated Complexity

- **New file**: ~250-300 lines (`InfinityBinPositionAdd.tsx`)
- **Modified files**: 2 small changes (Infinity/index.tsx wiring + TODO comment removal)
- **No new hooks or utilities needed**
- **No new dependencies**

---

## Testing Checklist

- [ ] Modal opens with correct position data displayed
- [ ] Price range shows existing position range with current price indicator
- [ ] Distribution shows correct token balances and percentages
- [ ] BinRangeSelector initializes from position and allows editing
- [ ] Liquidity shape picker works (Spot/Curve/Bid-Ask)
- [ ] Amount inputs work with max/percentage buttons
- [ ] Total USD value updates correctly
- [ ] Slippage tolerance displays and is editable
- [ ] Token approvals flow works (Permit2)
- [ ] Add button is disabled when form is invalid
- [ ] Validation messages show for: insufficient balance, invalid range, out of range
- [ ] Clicking Add triggers the confirmation popup (seeing the popup = success; do NOT confirm the actual transaction)
- [ ] Single-sided deposits work when out of range
