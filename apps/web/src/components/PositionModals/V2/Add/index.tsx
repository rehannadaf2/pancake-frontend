import { useTranslation } from '@pancakeswap/localization'
import { Currency, Percent } from '@pancakeswap/swap-sdk-core'
import { Box, PreTitle, RowBetween, Text } from '@pancakeswap/uikit'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import AddLiquidity, { LP2ChildrenProps } from 'views/AddLiquidity'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { CurrencyField as Field } from 'utils/types'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useCallback, useMemo } from 'react'
import { CommitButton } from 'components/CommitButton'
import { useExpertMode } from '@pancakeswap/utils/user'
import { logGTMClickAddLiquidityEvent } from 'utils/customGTMEventTracking'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import { BigNumber as BN } from 'bignumber.js'

interface V2PositionAddProps {
  position: V2LPDetail
  poolInfo: PoolInfo
}
export const V2PositionAdd = ({ position, poolInfo }: V2PositionAddProps) => {
  const { t } = useTranslation()

  // Currencies
  const { token0, token1 } = poolInfo
  const currency0 = token0 as Currency
  const currency1 = token1 as Currency

  return (
    <Box>
      <PreTitle>{t('Amount of Liquidity to Add')}</PreTitle>
      <RowBetween mt="8px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>

      <AddLiquidity currencyA={currency0} currencyB={currency1}>
        {(props) => <V2PositionAddInner {...props} />}
      </AddLiquidity>
    </Box>
  )
}

const V2PositionAddInner = ({
  formattedAmounts,
  addIsUnsupported,
  addIsWarning,
  shouldShowApprovalGroup,
  approveACallback,
  revokeACallback,
  currentAllowanceA,
  approvalA,
  approvalB,
  approveBCallback,
  revokeBCallback,
  currentAllowanceB,
  showFieldBApproval,
  showFieldAApproval,
  currencies,
  buttonDisabled,
  onAdd,
  onPresentAddLiquidityModal,
  errorText,
  onFieldAInput,
  onFieldBInput,
  maxAmounts,
  isOneWeiAttack,
  pair,
}: LP2ChildrenProps) => {
  const { t } = useTranslation()

  // User
  const { chainId: activeChainId } = useAccountActiveChain()
  const isWrongNetwork = activeChainId !== pair?.chainId
  const [expertMode] = useExpertMode()

  // Currencies
  const currency0 = currencies[Field.CURRENCY_A]
  const currency1 = currencies[Field.CURRENCY_B]

  // Amounts
  const amount0 = formattedAmounts[Field.CURRENCY_A]
  const amount1 = formattedAmounts[Field.CURRENCY_B]

  // Total USD Value
  const { data: currencyPrice0 } = useCurrencyUsdPrice(currency0, {
    enabled: !!currency0 && !!amount0,
  })
  const { data: currencyPrice1 } = useCurrencyUsdPrice(currency1, {
    enabled: !!currency1 && !!amount1,
  })
  const totalDepositUsdValue = useMemo(() => {
    if (!currencyPrice0 || !currencyPrice1) return 0

    const usd0 = BN(currencyPrice0).multipliedBy(amount0 || 0)
    const usd1 = BN(currencyPrice1).multipliedBy(amount1 || 0)

    return usd0.plus(usd1).toFormat(2)
  }, [currencyPrice0, currencyPrice1, amount0, amount1])

  const renderButtons = useCallback(() => {
    if (isWrongNetwork) return <CommitButton checkChainId={pair?.chainId} width="100%" />
    return (
      <CommitButton
        variant={buttonDisabled ? 'danger' : 'primary'}
        onClick={() => {
          // eslint-disable-next-line no-unused-expressions
          expertMode ? onAdd() : onPresentAddLiquidityModal()
          logGTMClickAddLiquidityEvent()
        }}
        disabled={buttonDisabled}
        width="100%"
      >
        {errorText || t('Add')}
      </CommitButton>
    )
  }, [isWrongNetwork, formattedAmounts, buttonDisabled, errorText, pair?.chainId, activeChainId])

  return (
    <>
      <LightGreyCard mt="16px" borderRadius="24px" padding="16px">
        <CurrencyInputPanelSimplify
          id="position-modal-increase-v2-A"
          defaultValue={formattedAmounts[Field.CURRENCY_A]}
          currency={currencies[Field.CURRENCY_A]}
          onUserInput={onFieldAInput}
          title={<>&nbsp;</>}
          wrapperProps={{ style: { backgroundColor: 'transparent' } }}
          onPercentInput={(percent) => {
            if (maxAmounts[Field.CURRENCY_A]) {
              onFieldBInput(maxAmounts[Field.CURRENCY_A]?.multiply(new Percent(percent, 100)).toExact() ?? '')
            }
          }}
          onMax={() => {
            onFieldBInput(maxAmounts[Field.CURRENCY_A]?.toExact() ?? '')
          }}
          maxAmount={maxAmounts[Field.CURRENCY_A]}
          showMaxButton
          disableCurrencySelect
          showUSDPrice
        />
        <br />
        <CurrencyInputPanelSimplify
          id="position-modal-increase-v2-B"
          defaultValue={formattedAmounts[Field.CURRENCY_B]}
          currency={currencies[Field.CURRENCY_B]}
          onUserInput={onFieldBInput}
          title={<>&nbsp;</>}
          wrapperProps={{ style: { backgroundColor: 'transparent' } }}
          onPercentInput={(percent) => {
            if (maxAmounts[Field.CURRENCY_B]) {
              onFieldBInput(maxAmounts[Field.CURRENCY_B]?.multiply(new Percent(percent, 100)).toExact() ?? '')
            }
          }}
          onMax={() => {
            onFieldBInput(maxAmounts[Field.CURRENCY_B]?.toExact() ?? '')
          }}
          maxAmount={maxAmounts[Field.CURRENCY_B]}
          showMaxButton
          disableCurrencySelect
          showUSDPrice
        />
      </LightGreyCard>

      <RowBetween mt="16px">
        <Text color="textSubtle" small>
          {t('Total Deposit Value')}
        </Text>
        <Text small>~${totalDepositUsdValue}</Text>
      </RowBetween>

      <Box mt="16px">{renderButtons()}</Box>
    </>
  )
}
