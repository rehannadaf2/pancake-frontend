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
import { FeeTierTooltip } from '@pancakeswap/widgets-internal'
import { Percent } from '@pancakeswap/sdk'
import { AprCalculatorV2 } from 'views/AddLiquidityV3/components/AprCalculatorV2'
import { PoolInfoDisplay } from '../shared/PoolInfoDisplay'
import { PositionTabType } from '../types'
import { V3PositionAdd } from './Add'

interface V3PositionModalContentProps {
  poolId?: Hex
  chainId?: number
  tab?: PositionTabType
  position?: InfinityCLPositionDetail | InfinityBinPositionDetail
}
export const V3PositionModalContent = ({ poolId, chainId, position, tab = 'Add' }: V3PositionModalContentProps) => {
  const { t } = useTranslation()

  const poolInfo = usePoolInfo({ poolAddress: poolId?.toLowerCase(), chainId })

  if (!poolInfo) return 'Unable to fetch pool info, or pool does not exist'

  return (
    <Box>
      <PoolInfoDisplay
        currency0={poolInfo.token0}
        currency1={poolInfo.token1}
        feeTierDisplay={
          <FeeTierTooltip
            type={poolInfo.protocol}
            percent={new Percent(poolInfo?.feeTier ?? 0n, poolInfo?.feeTierBase)}
            dynamic={poolInfo?.isDynamicFee}
            showType={false}
          />
        }
        rangeTags={
          <FlexGap gap="4px">
            <RangeTag outOfRange={false} lowContrast />
            {poolInfo?.isFarming && <Tag variant="primary60">{t('Farming')}</Tag>}
          </FlexGap>
        }
        aprDisplay={<AprCalculatorV2 pool={poolInfo} showTitle={false} derived showApyButton={false} fontSize="16px" />}
      />

      <Box mt="16px">
        {tab === 'Add' ? <V3PositionAdd position={position as InfinityCLPositionDetail} poolInfo={poolInfo} /> : null}
      </Box>
    </Box>
  )
}
