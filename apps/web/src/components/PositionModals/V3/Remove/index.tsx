import { useDebouncedChangeHandler } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { WNATIVE } from '@pancakeswap/sdk'
import { Currency } from '@pancakeswap/swap-sdk-core'
import {
  Box,
  Button,
  ChevronRightIcon,
  Flex,
  FlexGap,
  Message,
  RowBetween,
  Slider,
  Text,
  Toggle,
} from '@pancakeswap/uikit'
import { formatBigInt } from '@pancakeswap/utils/formatBalance'
import { useLiquidityUserSlippage } from '@pancakeswap/utils/user'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { BalanceDifferenceDisplay } from 'components/PositionModals/shared/BalanceDifferenceDisplay'
import { INITIAL_ALLOWED_SLIPPAGE } from 'config/constants'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useMasterchefV3 } from 'hooks/useContract'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { useDerivedV3BurnInfo } from 'hooks/v3/useDerivedV3BurnInfo'
import { useV3TokenIdsByAccount } from 'hooks/v3/useV3Positions'
import { useCallback, useMemo, useState } from 'react'
import { PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'
import { BigNumber as BN } from 'bignumber.js'

interface V3PositionRemoveProps {
  position: PositionDetail
  poolInfo: PoolInfo
}
export const V3PositionRemove = ({ position, poolInfo }: V3PositionRemoveProps) => {
  const { t } = useTranslation()

  // User
  const { account, chainId: activeChainId } = useAccountActiveChain()

  // Pool Info
  const currency0 = poolInfo.token0 as Currency
  const currency1 = poolInfo.token1 as Currency

  // Position Info
  const chainId = position.chainId ?? poolInfo.chainId
  const { tokenId } = position

  // Slippage
  const [allowedSlippage] = useLiquidityUserSlippage() || [INITIAL_ALLOWED_SLIPPAGE]

  // Percent selection
  const [percent, setPercent] = useState(50)
  const [percentForSlider, onPercentSelectForSlider] = useDebouncedChangeHandler(percent, setPercent)

  const handleChangePercent = useCallback(
    (value: any) => onPercentSelectForSlider(Math.ceil(value)),
    [onPercentSelectForSlider],
  )

  // Option to receive in Wrapped Tokens instead of Native
  const native = useNativeCurrency(chainId)
  const [receiveWNATIVE, setReceiveWNATIVE] = useState(false)

  // Remove LP Info
  const {
    position: positionSDK,
    liquidityPercentage,
    liquidityValue0,
    liquidityValue1,
    feeValue0,
    feeValue1,
    outOfRange,
    error,
  } = useDerivedV3BurnInfo(position, percent, receiveWNATIVE)

  const showCollectAsWNative = Boolean(
    liquidityValue0?.currency &&
      liquidityValue1?.currency &&
      (liquidityValue0.currency.isNative ||
        liquidityValue1.currency.isNative ||
        WNATIVE[liquidityValue0.currency.chainId]?.equals(liquidityValue0.currency.wrapped) ||
        WNATIVE[liquidityValue1.currency.chainId]?.equals(liquidityValue1.currency.wrapped)),
  )

  // MasterChef check if tokenId is staked in farm
  const masterchefV3 = useMasterchefV3()
  const isMasterChefV3Available = Boolean(masterchefV3?.address && masterchefV3?.address !== '0x')
  const { tokenIds: stakedTokenIds, loading: tokenIdsInMCv3Loading } = useV3TokenIdsByAccount(
    isMasterChefV3Available ? masterchefV3?.address : undefined,
    account,
  )
  const isStakedInMCv3 = useMemo(
    () => Boolean(tokenId && stakedTokenIds.find((id) => id === tokenId)),
    [tokenId, stakedTokenIds],
  )

  // USD Value of Tokens being Removed
  const { data: currency0Usd } = useCurrencyUsdPrice(currency0)
  const { data: currency1Usd } = useCurrencyUsdPrice(currency1)
  const removedTokensUsd = useMemo(() => {
    if (!liquidityValue0 || !liquidityValue1 || !currency0Usd || !currency1Usd) return '0'
    const usdValue0 = BN(liquidityValue0.toExact()).multipliedBy(currency0Usd)
    const usdValue1 = BN(liquidityValue1.toExact()).multipliedBy(currency1Usd)
    return usdValue0.plus(usdValue1).toFormat(2)
  }, [liquidityValue0, liquidityValue1, currency0Usd, currency1Usd])

  return (
    <Box>
      <RowBetween mb="4px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>

      {showCollectAsWNative && (
        <Flex justifyContent="space-between" alignItems="center" mt="16px">
          <Text color="textSubtle" small>
            {t('Collect as %symbol%', { symbol: native.wrapped.symbol })}
          </Text>
          <Toggle
            id="receive-as-wnative"
            scale="sm"
            checked={receiveWNATIVE}
            onChange={() => setReceiveWNATIVE((prevState) => !prevState)}
          />
        </Flex>
      )}

      <LightGreyCard mt="16px" padding="16px" borderRadius="24px">
        <Text fontSize="40px" bold mb="16px" style={{ lineHeight: 1 }}>
          {percentForSlider}%
        </Text>
        <Slider
          name="lp-amount"
          min={0}
          max={100}
          value={percentForSlider}
          onValueChanged={handleChangePercent}
          mb="16px"
        />
        <FlexGap gap="8px" justifyContent="space-between">
          <Button variant="primary60Outline" scale="sm" onClick={() => setPercent(25)} width="100%" borderRadius="12px">
            25%
          </Button>
          <Button variant="primary60Outline" scale="sm" onClick={() => setPercent(50)} width="100%" borderRadius="12px">
            50%
          </Button>
          <Button variant="primary60Outline" scale="sm" onClick={() => setPercent(75)} width="100%" borderRadius="12px">
            75%
          </Button>
          <Button
            variant="primary60Outline"
            scale="sm"
            onClick={() => setPercent(100)}
            width="100%"
            borderRadius="12px"
          >
            {t('Max.fill-max')}
          </Button>
        </FlexGap>
      </LightGreyCard>

      <BalanceDifferenceDisplay
        currency0={currency0}
        currency1={currency1}
        currency0Amount="999,999.99"
        currency0NewAmount="999,999.99"
        currency1Amount="999,999.99"
        currency1NewAmount="999,999.99"
        totalPositionUsd="$999,999.99"
        totalPositionNewUsd="$999,999.99"
        removedAmountUsd={`$${removedTokensUsd}`}
      />

      {isStakedInMCv3 ? (
        <Message variant="secondary60" mt="16px">
          <Text small>
            {t(
              'This liquidity position is currently staking in the Farm. Adding or removing liquidity will also harvest any unclaimed CAKE to your wallet.',
            )}
          </Text>
        </Message>
      ) : null}

      <Button mt="16px" width="100%">
        {t('Remove')}
      </Button>
    </Box>
  )
}
