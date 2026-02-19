import { useTranslation } from '@pancakeswap/localization'
import { Box, PreTitle, Text } from '@pancakeswap/uikit'
import { LightCard, LightGreyCard } from '@pancakeswap/widgets-internal'
import useIsTickAtLimit from 'hooks/infinity/useIsTickAtLimit'
import { useMemo } from 'react'
import { InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { PriceRangeDisplay } from 'views/PoolDetail/components/ProtocolPositionsTables'
import { calculateTickBasedPriceRange } from 'views/PoolDetail/utils/priceRange'

interface InfinityPositionAddProps {
  position: InfinityCLPositionDetail
  poolInfo: PoolInfo
}
export const InfinityCLPositionAdd = ({ position, poolInfo }: InfinityPositionAddProps) => {
  const { t } = useTranslation()

  const ticksAtLimit = useIsTickAtLimit(position.tickLower, position.tickUpper, position.tickSpacing)
  const priceDisplay = useMemo(() => {
    return calculateTickBasedPriceRange(
      position.tickLower,
      position.tickUpper,
      poolInfo.token0,
      poolInfo.token1,
      poolInfo,
      ticksAtLimit,
    )
  }, [position, poolInfo, ticksAtLimit])

  return (
    <Box>
      <LightGreyCard>
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
      </LightGreyCard>
    </Box>
  )
}
