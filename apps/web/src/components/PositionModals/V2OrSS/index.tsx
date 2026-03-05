import { Box, FlexGap, Tag } from '@pancakeswap/uikit'
import { Hex } from 'viem'
import { RangeTag } from 'components/RangeTag'
import { useTranslation } from '@pancakeswap/localization'
import { usePoolInfo } from 'state/farmsV4/hooks'
import { StableLPDetail, V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { FeeTierTooltip } from '@pancakeswap/widgets-internal'
import { Percent } from '@pancakeswap/sdk'
import { AprCalculatorV2 } from 'views/AddLiquidityV3/components/AprCalculatorV2'
import { Protocol } from '@pancakeswap/farms'
import { PoolInfoDisplay } from '../shared/PoolInfoDisplay'
import { PositionTabType } from '../types'
import { V2PositionAdd } from './Add/V2PositionAdd'
import { SSPositionAdd } from './Add/SSPositionAdd'
import { V2PositionRemove } from './Remove/V2PositionRemove'
import { SSPositionRemove } from './Remove/SSPositionRemove'

interface V2PositionModalContentProps {
  poolId?: Hex
  chainId?: number
  tab?: PositionTabType
  position?: V2LPDetail | StableLPDetail
  protocol: Protocol
}
export const V2OrSSPositionModalContent = ({
  poolId,
  chainId,
  position,
  protocol,
  tab = 'Add',
}: V2PositionModalContentProps) => {
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
        {protocol === Protocol.V2 ? (
          tab === 'Add' ? (
            <V2PositionAdd position={position as V2LPDetail} poolInfo={poolInfo} />
          ) : tab === 'Remove' ? (
            <V2PositionRemove position={position as V2LPDetail} poolInfo={poolInfo} />
          ) : null
        ) : protocol === Protocol.STABLE ? (
          tab === 'Add' ? (
            <SSPositionAdd position={position as StableLPDetail} poolInfo={poolInfo} />
          ) : tab === 'Remove' ? (
            <SSPositionRemove position={position as StableLPDetail} poolInfo={poolInfo} />
          ) : null
        ) : null}
      </Box>
    </Box>
  )
}
