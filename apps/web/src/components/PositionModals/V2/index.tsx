import { Box, FlexGap, Tag } from '@pancakeswap/uikit'
import { Hex } from 'viem'
import { RangeTag } from 'components/RangeTag'
import { useTranslation } from '@pancakeswap/localization'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { V2LPDetail, UnifiedPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { FeeTierTooltip } from '@pancakeswap/widgets-internal'
import { Percent } from '@pancakeswap/sdk'
import { AprCalculatorV2 } from 'views/AddLiquidityV3/components/AprCalculatorV2'
import { PoolInfoDisplay } from '../shared/PoolInfoDisplay'
import { PositionTabType } from '../types'
import { V2PositionAdd } from './Add'
// import { V3PositionAdd } from './Add'

interface V2PositionModalContentProps {
  poolId?: Hex
  chainId?: number
  tab?: PositionTabType
  position?: V2LPDetail
}
export const V2PositionModalContent = ({ poolId, chainId, position, tab = 'Add' }: V2PositionModalContentProps) => {
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
        {tab === 'Add' ? <V2PositionAdd position={position as V2LPDetail} poolInfo={poolInfo} /> : null}
      </Box>
    </Box>
  )
}
