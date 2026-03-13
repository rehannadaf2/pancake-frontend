import { Box, FlexGap, LoadingDot, Tag } from '@pancakeswap/uikit'
import { usePoolById } from 'hooks/infinity/usePool'
import { PoolState } from 'hooks/v3/types'
import { Hex } from 'viem'
import { InfinityFeeTierBreakdown } from 'components/FeeTierBreakdown'
import { RangeTag } from 'components/RangeTag'
import { useTranslation } from '@pancakeswap/localization'
import { InfinityBinPoolDerivedAprButton, InfinityCLPoolDerivedAprButton } from 'views/universalFarms/components'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { InfinityBinPoolInfo, InfinityCLPoolInfo } from 'state/farmsV4/state/type'
import { Protocol } from '@pancakeswap/farms'
import { InfinityBinPositionDetail, InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfoDisplay } from '../shared/PoolInfoDisplay'
import { PositionTabType } from '../types'
import { InfinityCLPositionAdd } from './Add'
import { InfinityBinPositionAdd } from './Add/InfinityBinPositionAdd'
import { InfinityCLPositionRemove } from './Remove/InfinityCLPositionRemove'
import { InfinityBinPositionRemove } from './Remove/InfinityBinPositionRemove'
import { InfinityCLPositionHarvest } from './Harvest/InfinityCLPositionHarvest'
import { InfinityBinPositionHarvest } from './Harvest/InfinityBinPositionHarvest'

interface InfinityPositionModalContentProps {
  poolId?: Hex
  chainId?: number
  tab?: PositionTabType
  position?: InfinityCLPositionDetail | InfinityBinPositionDetail
}
export const InfinityPositionModalContent = ({
  poolId,
  chainId,
  position,
  tab = 'Add',
}: InfinityPositionModalContentProps) => {
  const { t } = useTranslation()

  const poolInfo = usePoolInfo({ poolAddress: poolId?.toLowerCase(), chainId })

  if (!poolInfo) return 'Unable to fetch pool info, or pool does not exist'

  return (
    <Box>
      <PoolInfoDisplay
        currency0={poolInfo.token0}
        currency1={poolInfo.token1}
        feeTierDisplay={<InfinityFeeTierBreakdown poolId={poolId} poolInfo={poolInfo ?? undefined} chainId={chainId} />}
        rangeTags={
          <FlexGap gap="4px">
            <RangeTag outOfRange={false} lowContrast />
            {poolInfo?.isFarming && <Tag variant="primary60">{t('Farming')}</Tag>}
          </FlexGap>
        }
        aprDisplay={
          poolInfo ? (
            poolInfo.protocol === Protocol.InfinityBIN ? (
              <InfinityBinPoolDerivedAprButton pool={poolInfo as InfinityBinPoolInfo} />
            ) : (
              <InfinityCLPoolDerivedAprButton pool={poolInfo as InfinityCLPoolInfo} />
            )
          ) : null
        }
      />

      <Box mt="16px">
        {tab === 'Add' && poolInfo.protocol === Protocol.InfinityCLAMM ? (
          <InfinityCLPositionAdd position={position as InfinityCLPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Add' && poolInfo.protocol === Protocol.InfinityBIN ? (
          <InfinityBinPositionAdd position={position as InfinityBinPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Remove' && poolInfo.protocol === Protocol.InfinityCLAMM ? (
          <InfinityCLPositionRemove position={position as InfinityCLPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Remove' && poolInfo.protocol === Protocol.InfinityBIN ? (
          <InfinityBinPositionRemove position={position as InfinityBinPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Harvest' && poolInfo.protocol === Protocol.InfinityCLAMM ? (
          <InfinityCLPositionHarvest position={position as InfinityCLPositionDetail} poolInfo={poolInfo} />
        ) : tab === 'Harvest' && poolInfo.protocol === Protocol.InfinityBIN ? (
          <InfinityBinPositionHarvest position={position as InfinityBinPositionDetail} poolInfo={poolInfo} />
        ) : null}
      </Box>
    </Box>
  )
}
