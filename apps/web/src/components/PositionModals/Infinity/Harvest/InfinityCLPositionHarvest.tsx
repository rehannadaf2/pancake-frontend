import { getPoolId, type PoolKey } from '@pancakeswap/infinity-sdk'
import { useTranslation } from '@pancakeswap/localization'
import { Box, Button } from '@pancakeswap/uikit'
import { zeroAddress } from 'viem'
import { useFeesEarnedUSD } from 'hooks/infinity/useFeesEarned'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useMemo } from 'react'
import { bscTokens } from '@pancakeswap/tokens'
import { InfinityCLPositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { PoolInfo } from 'state/farmsV4/state/type'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { useFarmInfinityPositionActions } from 'views/universalFarms/hooks/useFarmInfinityPositionActions'
import useInfinityCollectFeeAction from 'views/universalFarms/hooks/useInfinityCollectFeeAction'
import { useCheckShouldSwitchNetwork } from 'views/universalFarms/hooks'
import { UnclaimedFeesDisplay } from '../../shared/UnclaimedFeesDisplay'
import { FarmingRewardsDisplay } from '../../shared/FarmingRewardsDisplay'

interface InfinityCLPositionHarvestProps {
  position: InfinityCLPositionDetail
  poolInfo: PoolInfo
}

export const InfinityCLPositionHarvest = ({ position, poolInfo }: InfinityCLPositionHarvestProps) => {
  const { t } = useTranslation()
  const { chainId: activeChainId } = useAccountActiveChain()
  const { switchNetworkIfNecessary, isLoading: isSwitchNetworkLoading } = useCheckShouldSwitchNetwork()
  const [, setLatestTxReceipt] = useLatestTxReceipt()

  const chainId = position.chainId ?? poolInfo.chainId
  const needsSwitchNetwork = activeChainId !== chainId
  const currency0 = poolInfo.token0
  const currency1 = poolInfo.token1
  const { poolKey, tokenId, tickLower, tickUpper } = position

  const poolId = useMemo(() => (poolKey ? getPoolId(poolKey) : undefined), [poolKey])

  const { feeAmount0, feeAmount1, fiatValue0, fiatValue1, totalFiatValue } = useFeesEarnedUSD({
    currency0,
    currency1,
    tokenId,
    poolId,
    tickLower,
    tickUpper,
  })

  const feeUsd0 = useMemo(() => (fiatValue0 ? Number(fiatValue0.toExact()) : undefined), [fiatValue0])
  const feeUsd1 = useMemo(() => (fiatValue1 ? Number(fiatValue1.toExact()) : undefined), [fiatValue1])
  const totalFeesUsd = useMemo(() => {
    if (feeUsd0 === undefined && feeUsd1 === undefined) return undefined
    return (feeUsd0 ?? 0) + (feeUsd1 ?? 0)
  }, [feeUsd0, feeUsd1])

  const { onCollect, attemptingTx: collectAttemptingTx } = useInfinityCollectFeeAction({
    chainId,
    onDone: (hash) => setLatestTxReceipt({ blockHash: hash, status: 'success' }),
  })

  const handleCollect = async () => {
    if (!poolKey) return
    await onCollect({
      tokenId,
      poolKey: poolKey as PoolKey<'CL'>,
      wrapAddress: zeroAddress,
    })
  }

  const collectDisabled = collectAttemptingTx || !(feeAmount0?.greaterThan(0) || feeAmount1?.greaterThan(0))

  const {
    rewardsCurrencyAmount,
    totalRewardsAmount,
    totalRewardsUSD,
    hasUnclaimedRewards,
    onHarvest,
    attemptingTx: harvestAttemptingTx,
  } = useFarmInfinityPositionActions({
    chainId,
    poolId,
    position,
    onDone: (receipt) => setLatestTxReceipt(receipt ?? undefined),
  })

  const showFarmRewards = hasUnclaimedRewards && totalRewardsAmount.isGreaterThan(0)

  return (
    <Box>
      <UnclaimedFeesDisplay
        currency0={currency0}
        currency1={currency1}
        feeAmount0={feeAmount0}
        feeAmount1={feeAmount1}
        feeUsd0={feeUsd0}
        feeUsd1={feeUsd1}
        totalFeesUsd={totalFeesUsd}
        onCollect={handleCollect}
        collecting={collectAttemptingTx}
        disabled={collectDisabled}
        hideButton={needsSwitchNetwork}
      />

      {showFarmRewards ? (
        <Box mt="16px">
          <FarmingRewardsDisplay
            rewardToken={bscTokens.cake}
            rewardsAmount={rewardsCurrencyAmount?.toSignificant(6) ?? totalRewardsAmount.toFixed(6)}
            rewardsUSD={totalRewardsUSD}
            onHarvest={onHarvest}
            harvesting={harvestAttemptingTx}
            disabled={harvestAttemptingTx || !hasUnclaimedRewards}
            hideButton={needsSwitchNetwork}
          />
        </Box>
      ) : null}

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
