import { useTranslation } from '@pancakeswap/localization'
import { Box, FlexGap, IconButton, PreTitle, RowBetween, SwapHorizIcon, Text } from '@pancakeswap/uikit'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { LightCard, LightGreyCard } from '@pancakeswap/widgets-internal'
import useIsTickAtLimit from 'hooks/infinity/useIsTickAtLimit'
import { useCallback, useMemo, useState } from 'react'
import { InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { PriceRangeDisplay } from 'views/PoolDetail/components/ProtocolPositionsTables'
import { calculateTickBasedPriceRange } from 'views/PoolDetail/utils/priceRange'
import { LiquiditySlippageButton } from 'views/Swap/components/SlippageButton'

interface InfinityPositionAddProps {
  position: InfinityCLPositionDetail
  poolInfo: PoolInfo
}
export const InfinityCLPositionAdd = ({ position, poolInfo }: InfinityPositionAddProps) => {
  const { t } = useTranslation()
  const { token0, token1, token0Price, token1Price } = poolInfo

  const [inverted, setInverted] = useState(false)

  const ticksAtLimit = useIsTickAtLimit(position.tickLower, position.tickUpper, position.tickSpacing)

  const priceDisplay = useMemo(() => {
    return calculateTickBasedPriceRange(
      position.tickLower,
      position.tickUpper,
      poolInfo.token0,
      poolInfo.token1,
      poolInfo,
      ticksAtLimit,
      inverted,
    )
  }, [position, poolInfo, ticksAtLimit, inverted])

  const toggleInverted = useCallback(() => {
    setInverted(!inverted)
  }, [inverted, setInverted])

  return (
    <Box>
      <LightGreyCard borderRadius="24px" padding="16px">
        <PreTitle mb="8px">{t('Price Range (Min-Max)')}</PreTitle>
        <PriceRangeDisplay
          minPrice={priceDisplay.minPriceFormatted}
          maxPrice={priceDisplay.maxPriceFormatted}
          minPriceRaw={priceDisplay.minPrice}
          maxPriceRaw={priceDisplay.maxPrice}
          currentPriceRaw={priceDisplay.currentPriceValue}
          minPercentage="0%"
          maxPercentage="100%"
          maxWidth="unset"
        />
        <RowBetween mt="8px">
          <Text color="textSubtle" small>
            {t('Current Price')}
          </Text>
          <FlexGap gap="2px">
            <Text small>
              {token0Price && token1Price
                ? formatNumber(inverted ? token0Price : token1Price, {
                    maximumDecimalTrailingZeroes: 5,
                    maximumSignificantDigits: 8,
                  })
                : '-'}
            </Text>
            <Text color="textSubtle" small>
              {t('%symbol0% per %symbol1%', {
                symbol0: inverted ? token0.symbol : token1.symbol,
                symbol1: inverted ? token1.symbol : token0.symbol,
              })}
            </Text>
            <IconButton variant="text" onClick={toggleInverted} scale="xs">
              <SwapHorizIcon color="primary60" width="16px" mt="2px" />
            </IconButton>
          </FlexGap>
        </RowBetween>
      </LightGreyCard>

      <PreTitle mt="16px">{t('Amount of liquidity to add')}</PreTitle>
      <RowBetween mt="8px">
        <Text color="textSubtle" small>
          {t('Slippage Tolerance')}
        </Text>
        <LiquiditySlippageButton />
      </RowBetween>
    </Box>
  )
}
