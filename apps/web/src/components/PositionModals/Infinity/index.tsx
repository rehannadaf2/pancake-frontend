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
import { PoolInfoDisplay } from '../shared/PoolInfoDisplay'

interface InfinityPositionModalContentProps {
  poolId?: Hex
  chainId?: number
}
export const InfinityPositionModalContent = ({ poolId, chainId }: InfinityPositionModalContentProps) => {
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
    </Box>
  )
}
