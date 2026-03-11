import { Box, Text } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import BigNumber from 'bignumber.js'
import { bscTokens } from '@pancakeswap/tokens'
import { useUserAllFarmRewardsByChainIdFromAPI } from 'hooks/infinity/useFarmReward'
import { useCakePrice } from 'hooks/useCakePrice'
import { useMemo } from 'react'
import { InfinityBinPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import useFarmInfinityActions from 'views/universalFarms/hooks/useFarmInfinityActions'
import { useAccount } from 'wagmi'
import { FarmingRewardsDisplay } from '../../shared/FarmingRewardsDisplay'

interface InfinityBinPositionHarvestProps {
  position: InfinityBinPositionDetail
  poolInfo: PoolInfo
}

export const InfinityBinPositionHarvest = ({ position, poolInfo }: InfinityBinPositionHarvestProps) => {
  const { t } = useTranslation()
  const { address } = useAccount()
  const [, setLatestTxReceipt] = useLatestTxReceipt()

  const chainId = position.chainId ?? poolInfo.chainId

  const { totalUnclaimedRewards } = useUserAllFarmRewardsByChainIdFromAPI({
    chainId,
    user: address,
  })

  const { onHarvest, attemptingTx, hasUnclaimedRewards } = useFarmInfinityActions({
    chainId,
    onDone: setLatestTxReceipt,
  })

  const cakePrice = useCakePrice()

  const totalRewardsAmount = useMemo(
    () => totalUnclaimedRewards.reduce((acc, item) => new BigNumber(item.totalReward).plus(acc), new BigNumber(0)),
    [totalUnclaimedRewards],
  )
  const totalRewardsUSD = useMemo(() => totalRewardsAmount.times(cakePrice).toNumber(), [totalRewardsAmount, cakePrice])

  if (!hasUnclaimedRewards || totalRewardsAmount.isLessThanOrEqualTo(0)) {
    return (
      <Box>
        <Text color="textSubtle" textAlign="center" py="24px">
          {t('No farming rewards to harvest')}
        </Text>
      </Box>
    )
  }

  return (
    <Box>
      <FarmingRewardsDisplay
        rewardToken={bscTokens.cake}
        rewardsAmount={totalRewardsAmount.toFixed(4)}
        rewardsUSD={totalRewardsUSD}
        onHarvest={onHarvest}
        harvesting={attemptingTx}
        disabled={attemptingTx || !hasUnclaimedRewards}
      />
    </Box>
  )
}
