import { getPoolId } from '@pancakeswap/infinity-sdk'
import { Box, Button, Text } from '@pancakeswap/uikit'
import { useTranslation } from '@pancakeswap/localization'
import { useMemo } from 'react'
import { bscTokens } from '@pancakeswap/tokens'
import { InfinityBinPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { useFarmInfinityPositionActions } from 'views/universalFarms/hooks/useFarmInfinityPositionActions'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { FarmingRewardsDisplay } from '../../shared/FarmingRewardsDisplay'

interface InfinityBinPositionHarvestProps {
  position: InfinityBinPositionDetail
  poolInfo: PoolInfo
}

export const InfinityBinPositionHarvest = ({ position, poolInfo }: InfinityBinPositionHarvestProps) => {
  const { t } = useTranslation()
  const { chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const [, setLatestTxReceipt] = useLatestTxReceipt()

  const chainId = position.chainId ?? poolInfo.chainId
  const needsSwitchNetwork = activeChainId !== chainId
  const poolId = position.poolKey ? getPoolId(position.poolKey) : position.poolId

  const { rewardsCurrencyAmount, totalRewardsAmount, totalRewardsUSD, hasUnclaimedRewards, onHarvest, attemptingTx } =
    useFarmInfinityPositionActions({
      chainId,
      poolId,
      position,
      onDone: (receipt) => setLatestTxReceipt(receipt ?? undefined),
    })

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
        rewardsAmount={rewardsCurrencyAmount?.toSignificant(6) ?? totalRewardsAmount.toFixed(6)}
        rewardsUSD={totalRewardsUSD}
        onHarvest={onHarvest}
        harvesting={attemptingTx}
        disabled={attemptingTx || !hasUnclaimedRewards}
        hideButton={needsSwitchNetwork}
      />

      {needsSwitchNetwork && (
        <Button
          mt="16px"
          width="100%"
          onClick={() => (chainId ? switchNetworkIfNecessary(chainId) : undefined)}
          disabled={isSwitchNetworkLoading}
        >
          {t('Switch Network')}
        </Button>
      )}
    </Box>
  )
}
