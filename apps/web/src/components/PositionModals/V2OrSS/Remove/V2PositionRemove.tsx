import { useDebouncedChangeHandler } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, Percent, WNATIVE } from '@pancakeswap/sdk'
import { Box, Button, Flex, FlexGap, PreTitle, RowBetween, Slider, Text, Toggle } from '@pancakeswap/uikit'
import { INITIAL_ALLOWED_SLIPPAGE, useLiquidityUserSlippage } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { BigNumber as BN } from 'bignumber.js'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { formattedCurrencyAmount } from 'components/FormattedCurrencyAmount/FormattedCurrencyAmount'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import { V2_ROUTER_ADDRESS } from 'config/constants/exchange'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { ApprovalState, useApproveCallback } from 'hooks/useApproveCallback'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { useTransactionDeadline } from 'hooks/useTransactionDeadline'
import { useCallback, useMemo, useState } from 'react'
import { Field } from 'state/burn/actions'
import { useBurnActionHandlers, useDerivedBurnInfo } from 'state/burn/hooks'
import { createFormAtom, RemoveLiquidityV2AtomProvider, useRemoveLiquidityV2FormState } from 'state/burn/reducer'
import { V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useTransactionAdder } from 'state/transactions/hooks'
import { useGasPrice } from 'state/user/hooks'
import { calculateGasMargin } from 'utils'
import { logGTMClickRemoveLiquidityEvent } from 'utils/customGTMEventTracking'
import { calculateSlippageAmount, useRouterContract } from 'utils/exchange'
import { isUserRejected, logError } from 'utils/sentry'
import { transactionErrorToUserReadableMessage } from 'utils/transactionErrorToUserReadableMessage'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { Hash } from 'viem'

interface V2PositionRemoveProps {
  position: V2LPDetail
  poolInfo: PoolInfo
}

const formAtom = createFormAtom()

export const V2PositionRemove = ({ position, poolInfo }: V2PositionRemoveProps) => {
  return (
    <RemoveLiquidityV2AtomProvider value={{ formAtom }}>
      <V2PositionRemoveInner position={position} poolInfo={poolInfo} />
    </RemoveLiquidityV2AtomProvider>
  )
}

const V2PositionRemoveInner = ({ position, poolInfo }: V2PositionRemoveProps) => {
  const { t } = useTranslation()
  const { account, chainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const positionChainId = poolInfo.chainId
  const gasPrice = useGasPrice()

  const currency0 = poolInfo.token0 as Currency
  const currency1 = poolInfo.token1 as Currency
  const [tokenA, tokenB] = useMemo(() => [currency0?.wrapped, currency1?.wrapped], [currency0, currency1])

  const { independentField, typedValue } = useRemoveLiquidityV2FormState()
  const { pair, parsedAmounts, error } = useDerivedBurnInfo(currency0, currency1)
  const { onUserInput: _onUserInput } = useBurnActionHandlers()

  const [showDetailed, setShowDetailed] = useState(false)
  const [{ attemptingTxn, liquidityErrorMessage }, setLiquidityState] = useState<{
    attemptingTxn: boolean
    liquidityErrorMessage: string | undefined
    txHash: string | undefined
  }>({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: undefined })

  const [deadline] = useTransactionDeadline()
  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]

  const formattedAmounts = {
    [Field.LIQUIDITY_PERCENT]: parsedAmounts[Field.LIQUIDITY_PERCENT].equalTo('0')
      ? '0'
      : parsedAmounts[Field.LIQUIDITY_PERCENT].lessThan(new Percent('1', '100'))
      ? '<1'
      : parsedAmounts[Field.LIQUIDITY_PERCENT].toFixed(0),
    [Field.LIQUIDITY]:
      independentField === Field.LIQUIDITY
        ? typedValue
        : formattedCurrencyAmount({ currencyAmount: parsedAmounts[Field.LIQUIDITY] }),
    [Field.CURRENCY_A]:
      independentField === Field.CURRENCY_A
        ? typedValue
        : formattedCurrencyAmount({ currencyAmount: parsedAmounts[Field.CURRENCY_A] }),
    [Field.CURRENCY_B]:
      independentField === Field.CURRENCY_B
        ? typedValue
        : formattedCurrencyAmount({ currencyAmount: parsedAmounts[Field.CURRENCY_B] }),
  }

  const { approvalState, approveCallback } = useApproveCallback(
    parsedAmounts[Field.LIQUIDITY],
    chainId ? V2_ROUTER_ADDRESS[chainId] : undefined,
  )

  const onUserInput = useCallback((field: Field, value: string) => _onUserInput(field, value), [_onUserInput])

  const onLiquidityPercentInput = useCallback(
    (value: string) => onUserInput(Field.LIQUIDITY_PERCENT, value),
    [onUserInput],
  )
  const onCurrencyAInput = useCallback((value: string) => onUserInput(Field.CURRENCY_A, value), [onUserInput])
  const onCurrencyBInput = useCallback((value: string) => onUserInput(Field.CURRENCY_B, value), [onUserInput])

  const liquidityPercentChangeCallback = useCallback(
    (value: number) => onLiquidityPercentInput(Math.ceil(value).toString()),
    [onLiquidityPercentInput],
  )

  const [innerLiquidityPercentage, setInnerLiquidityPercentage] = useDebouncedChangeHandler(
    Number.parseInt(formattedAmounts[Field.LIQUIDITY_PERCENT]),
    liquidityPercentChangeCallback,
  )

  const routerContract = useRouterContract()
  const addTransaction = useTransactionAdder()

  const onRemove = useCallback(async () => {
    if (!chainId || !account || !deadline || !routerContract) return

    const { [Field.CURRENCY_A]: currencyAmountA, [Field.CURRENCY_B]: currencyAmountB } = parsedAmounts
    if (!currencyAmountA || !currencyAmountB || !currency0 || !currency1 || !tokenA || !tokenB) return

    const amountsMin = {
      [Field.CURRENCY_A]: calculateSlippageAmount(currencyAmountA, allowedSlippage)[0],
      [Field.CURRENCY_B]: calculateSlippageAmount(currencyAmountB, allowedSlippage)[0],
    }

    const liquidityAmount = parsedAmounts[Field.LIQUIDITY]
    if (!liquidityAmount) return

    const currencyBIsNative = currency1?.isNative
    const oneCurrencyIsNative = currency0?.isNative || currencyBIsNative

    let methodNames: string[]
    let args: any

    if (approvalState === ApprovalState.APPROVED) {
      if (oneCurrencyIsNative) {
        methodNames = ['removeLiquidityETH', 'removeLiquidityETHSupportingFeeOnTransferTokens']
        args = [
          currencyBIsNative ? tokenA.address : tokenB.address,
          liquidityAmount.quotient.toString(),
          amountsMin[currencyBIsNative ? Field.CURRENCY_A : Field.CURRENCY_B].toString(),
          amountsMin[currencyBIsNative ? Field.CURRENCY_B : Field.CURRENCY_A].toString(),
          account,
          deadline,
        ]
      } else {
        methodNames = ['removeLiquidity']
        args = [
          tokenA.address,
          tokenB.address,
          liquidityAmount.quotient.toString(),
          amountsMin[Field.CURRENCY_A].toString(),
          amountsMin[Field.CURRENCY_B].toString(),
          account,
          deadline,
        ]
      }
    } else {
      return
    }

    let methodSafeGasEstimate: { methodName: string; safeGasEstimate: bigint } | undefined
    for (let i = 0; i < methodNames.length; i++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const est = await routerContract.estimateGas[methodNames[i]](args, { account })
        methodSafeGasEstimate = { methodName: methodNames[i], safeGasEstimate: calculateGasMargin(est) }
        break
      } catch (e) {
        console.error(`estimateGas failed`, methodNames[i], args, e)
      }
    }

    if (!methodSafeGasEstimate) return

    const { methodName, safeGasEstimate } = methodSafeGasEstimate
    setLiquidityState({ attemptingTxn: true, liquidityErrorMessage: undefined, txHash: undefined })

    await routerContract.write[methodName](args, { gas: safeGasEstimate, gasPrice })
      .then((response: Hash) => {
        setLiquidityState({ attemptingTxn: false, liquidityErrorMessage: undefined, txHash: response })
        const amountA = parsedAmounts[Field.CURRENCY_A]?.toSignificant(3)
        const amountB = parsedAmounts[Field.CURRENCY_B]?.toSignificant(3)
        addTransaction(
          { hash: response },
          {
            summary: `Remove ${amountA} ${currency0?.symbol} and ${amountB} ${currency1?.symbol}`,
            translatableSummary: {
              text: 'Remove %amountA% %symbolA% and %amountB% %symbolB%',
              data: { amountA, symbolA: currency0?.symbol, amountB, symbolB: currency1?.symbol },
            },
            type: 'remove-liquidity',
          },
        )
      })
      .catch((err: any) => {
        if (err && !isUserRejected(err)) {
          logError(err)
          console.error(`Remove Liquidity failed`, err, args)
        }
        setLiquidityState({
          attemptingTxn: false,
          liquidityErrorMessage:
            err && !isUserRejected(err)
              ? t('Remove liquidity failed: %message%', { message: transactionErrorToUserReadableMessage(err, t) })
              : undefined,
          txHash: undefined,
        })
      })
  }, [
    chainId,
    account,
    deadline,
    routerContract,
    parsedAmounts,
    currency0,
    currency1,
    tokenA,
    tokenB,
    allowedSlippage,
    approvalState,
    gasPrice,
    addTransaction,
    t,
  ])

  const { data: currency0Usd } = useCurrencyUsdPrice(currency0)
  const { data: currency1Usd } = useCurrencyUsdPrice(currency1)

  // Full position amounts (at 100%)
  const fullAmountA = useMemo(() => {
    if (!parsedAmounts[Field.CURRENCY_A] || parsedAmounts[Field.LIQUIDITY_PERCENT].equalTo('0')) return undefined
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    const amt = parsedAmounts[Field.CURRENCY_A]
    if (pct.equalTo('0')) return undefined
    return BN(amt.toExact()).dividedBy(BN(pct.numerator.toString()).dividedBy(pct.denominator.toString()))
  }, [parsedAmounts])

  const fullAmountB = useMemo(() => {
    if (!parsedAmounts[Field.CURRENCY_B] || parsedAmounts[Field.LIQUIDITY_PERCENT].equalTo('0')) return undefined
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    const amt = parsedAmounts[Field.CURRENCY_B]
    if (pct.equalTo('0')) return undefined
    return BN(amt.toExact()).dividedBy(BN(pct.numerator.toString()).dividedBy(pct.denominator.toString()))
  }, [parsedAmounts])

  const currency0Amount = useMemo(() => {
    const amt = parsedAmounts[Field.CURRENCY_A]
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    if (!amt || pct.equalTo('0')) return '0'
    return amt.multiply(new Percent(pct.denominator.toString(), pct.numerator.toString())).toSignificant(6)
  }, [parsedAmounts])

  const currency1Amount = useMemo(() => {
    const amt = parsedAmounts[Field.CURRENCY_B]
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    if (!amt || pct.equalTo('0')) return '0'
    return amt.multiply(new Percent(pct.denominator.toString(), pct.numerator.toString())).toSignificant(6)
  }, [parsedAmounts])

  const currency0NewAmount = useMemo(() => {
    const amt = parsedAmounts[Field.CURRENCY_A]
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    if (!amt || pct.equalTo('0')) return currency0Amount
    if (innerLiquidityPercentage >= 100) return '0'
    // total × (100 - live%) / 100
    return amt
      .multiply(new Percent(pct.denominator.toString(), pct.numerator.toString()))
      .multiply(new Percent(100 - innerLiquidityPercentage, 100))
      .toSignificant(6)
  }, [parsedAmounts, currency0Amount, innerLiquidityPercentage])

  const currency1NewAmount = useMemo(() => {
    const amt = parsedAmounts[Field.CURRENCY_B]
    const pct = parsedAmounts[Field.LIQUIDITY_PERCENT]
    if (!amt || pct.equalTo('0')) return currency1Amount
    if (innerLiquidityPercentage >= 100) return '0'
    // total × (100 - live%) / 100
    return amt
      .multiply(new Percent(pct.denominator.toString(), pct.numerator.toString()))
      .multiply(new Percent(100 - innerLiquidityPercentage, 100))
      .toSignificant(6)
  }, [parsedAmounts, currency1Amount, innerLiquidityPercentage])

  const totalPositionUsd = useMemo(() => {
    if (!fullAmountA || !fullAmountB || !currency0Usd || !currency1Usd) return '$0'
    const usd0 = fullAmountA.multipliedBy(currency0Usd)
    const usd1 = fullAmountB.multipliedBy(currency1Usd)
    return `$${usd0.plus(usd1).toFormat(2)}`
  }, [fullAmountA, fullAmountB, currency0Usd, currency1Usd])

  const removedTokensUsd = useMemo(() => {
    if (!fullAmountA || !fullAmountB || !currency0Usd || !currency1Usd) return '0'
    const usd0 = fullAmountA.multipliedBy(currency0Usd).multipliedBy(innerLiquidityPercentage / 100)
    const usd1 = fullAmountB.multipliedBy(currency1Usd).multipliedBy(innerLiquidityPercentage / 100)
    return usd0.plus(usd1).toFormat(2)
  }, [fullAmountA, fullAmountB, currency0Usd, currency1Usd, innerLiquidityPercentage])

  const totalPositionNewUsd = useMemo(() => {
    if (totalPositionUsd === '$0' || removedTokensUsd === '0') return totalPositionUsd
    const total = BN(totalPositionUsd.replace(/[$,]/g, ''))
    const removed_ = BN(removedTokensUsd.replace(/,/g, ''))
    const result = total.minus(removed_)
    return `$${result.isNegative() ? '0' : result.toFormat(2)}`
  }, [totalPositionUsd, removedTokensUsd])

  // RATES section
  const rate0Per1 = useMemo(() => {
    if (!pair) return undefined
    return pair.token0Price.toSignificant(6)
  }, [pair])

  const rate1Per0 = useMemo(() => {
    if (!pair) return undefined
    return pair.token1Price.toSignificant(6)
  }, [pair])

  const isValid = !error
  const needsApproval = approvalState !== ApprovalState.APPROVED

  return (
    <Box>
      <RowBetween mb="4px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>

      <Flex justifyContent="space-between" alignItems="center" mt="16px">
        <PreTitle>{t('Amount of liquidity to remove')}</PreTitle>
        <Flex alignItems="center" style={{ gap: '8px' }}>
          <Text color="textSubtle" small>
            {t('Detailed')}
          </Text>
          <Toggle scale="sm" checked={showDetailed} onChange={() => setShowDetailed((prev) => !prev)} />
        </Flex>
      </Flex>

      {showDetailed ? (
        <Box mt="8px">
          <CurrencyInputPanelSimplify
            defaultValue={formattedAmounts[Field.CURRENCY_A]}
            onUserInput={onCurrencyAInput}
            currency={currency0}
            id="remove-liquidity-tokena"
            disableCurrencySelect
            showMaxButton={false}
          />
          <Box mt="8px">
            <CurrencyInputPanelSimplify
              defaultValue={formattedAmounts[Field.CURRENCY_B]}
              onUserInput={onCurrencyBInput}
              currency={currency1}
              id="remove-liquidity-tokenb"
              disableCurrencySelect
              showMaxButton={false}
            />
          </Box>
        </Box>
      ) : (
        <LightGreyCard mt="8px" padding="16px" borderRadius="24px">
          <Text fontSize="40px" bold mb="16px" style={{ lineHeight: 1 }}>
            {innerLiquidityPercentage}%
          </Text>
          <Slider
            name="lp-amount"
            min={0}
            max={100}
            value={innerLiquidityPercentage}
            onValueChanged={(value) => setInnerLiquidityPercentage(Math.ceil(value))}
            mb="16px"
          />
          <FlexGap gap="8px" justifyContent="space-between">
            <Button
              variant="primary60Outline"
              scale="sm"
              onClick={() => onLiquidityPercentInput('10')}
              width="100%"
              borderRadius="12px"
            >
              10%
            </Button>
            <Button
              variant="primary60Outline"
              scale="sm"
              onClick={() => onLiquidityPercentInput('20')}
              width="100%"
              borderRadius="12px"
            >
              20%
            </Button>
            <Button
              variant="primary60Outline"
              scale="sm"
              onClick={() => onLiquidityPercentInput('75')}
              width="100%"
              borderRadius="12px"
            >
              75%
            </Button>
            <Button
              variant="primary60Outline"
              scale="sm"
              onClick={() => onLiquidityPercentInput('100')}
              width="100%"
              borderRadius="12px"
            >
              {t('Max.fill-max')}
            </Button>
          </FlexGap>
        </LightGreyCard>
      )}

      {/* RATES */}
      {pair && rate0Per1 && rate1Per0 && (
        <LightGreyCard mt="16px" padding="12px 16px" borderRadius="24px">
          <PreTitle mb="8px">{t('Rates')}</PreTitle>
          <Flex justifyContent="space-between">
            <Text small color="textSubtle">
              1 {currency0?.symbol}
            </Text>
            <Text small>
              {rate1Per0} {currency1?.symbol}
            </Text>
          </Flex>
          <Flex justifyContent="space-between" mt="4px">
            <Text small color="textSubtle">
              1 {currency1?.symbol}
            </Text>
            <Text small>
              {rate0Per1} {currency0?.symbol}
            </Text>
          </Flex>
        </LightGreyCard>
      )}

      <BalanceDifferenceDisplay
        currency0={currency0}
        currency1={currency1}
        currency0Amount={currency0Amount}
        currency0NewAmount={currency0NewAmount}
        currency1Amount={currency1Amount}
        currency1NewAmount={currency1NewAmount}
        totalPositionUsd={totalPositionUsd}
        totalPositionNewUsd={totalPositionNewUsd}
        removedAmountUsd={`$${removedTokensUsd}`}
      />

      {chainId !== positionChainId ? (
        <Button
          mt="16px"
          width="100%"
          onClick={() => (positionChainId ? switchNetworkIfNecessary(positionChainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      ) : needsApproval ? (
        <Button
          mt="16px"
          width="100%"
          disabled={approvalState === ApprovalState.PENDING || !isValid}
          onClick={approveCallback}
        >
          {approvalState === ApprovalState.PENDING ? t('Enabling...') : t('Enable')}
        </Button>
      ) : (
        <Button
          mt="16px"
          width="100%"
          disabled={attemptingTxn || !isValid}
          onClick={() => {
            onRemove()
            logGTMClickRemoveLiquidityEvent()
          }}
        >
          {error ?? t('Remove')}
        </Button>
      )}
    </Box>
  )
}
