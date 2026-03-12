import { Protocol, fetchAllUniversalFarmsMap } from '@pancakeswap/farms'
import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import BigNumber from 'bignumber.js'
import { isSolana } from '@pancakeswap/chains'
import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import dayjs from 'dayjs'
import { getTokenByAddress } from '@pancakeswap/tokens'

import { useActiveChainId } from 'hooks/useActiveChainId'
import { useCakePrice } from 'hooks/useCakePrice'
import { useUserAllFarmRewardsByChainIdFromAPI, usePoolFarmRewardsFormAPI } from 'hooks/infinity/useFarmReward'
import { useStakedPositionsByUser } from 'state/farmsV3/hooks'
import {
  useAccountInfinityCLPositions,
  useAccountInfinityBinPositions,
  useAccountV3Positions,
  useAccountV2LpDetails,
  useAccountStableLpDetails,
} from 'state/farmsV4/state/accountPositions/hooks'
import { useAccountInfinityStablePositions } from 'state/farmsV4/state/accountPositions/hooks/useAccountInfinityStablePositions'
import type {
  PositionDetail,
  V2LPDetail,
  StableLPDetail,
  InfinityCLPositionDetail,
  InfinityBinPositionDetail,
} from 'state/farmsV4/state/accountPositions/type'
import type { V2PoolInfo, StablePoolInfo } from 'state/farmsV4/state/type'
import { formatBigInt } from '@pancakeswap/utils/formatBalance'
import { useAllEvmChainIds } from 'views/universalFarms/hooks/useMultiChains'

import type { SolanaPositionItem } from '../SolanaHarvestPanel'
import type { V2HarvestTarget } from './useEvmHarvestAll'
import type { SolanaHarvestTarget } from './useSolanaHarvestAll'

export interface V3HarvestPositionEnriched {
  position: PositionDetail
  pendingCakeAmount: number
  earningsUSD: number
}

export interface InfinityHarvestPositionEnriched {
  position: InfinityCLPositionDetail | InfinityBinPositionDetail
  earningsUSD: number
  cakeAmount: number
}

export interface HarvestModalData {
  v3HarvestPositions: V3HarvestPositionEnriched[]
  infinityHarvestPositions: InfinityHarvestPositionEnriched[]
  v2Positions: V2LPDetail[]
  stablePositions: StableLPDetail[]
  evmTotalEarningsUSD: number
  v3StakedTokenIds: string[]
  v2Targets: V2HarvestTarget[]
  otherChainsWithRewards: number[]
  solanaPositions: SolanaPositionItem[]
  solanaTotalEarningsUSD: number
  solanaHarvestTargets: SolanaHarvestTarget[]
  totalEarningsUSD: number
  isLoading: boolean
}

/**
 * Self-contained hook: fetches all EVM + Solana positions and computes harvest data.
 */
export function useHarvestModalData(): HarvestModalData {
  const { chainId } = useActiveChainId()
  const { address: account } = useAccount()
  const cakePrice = useCakePrice()
  const allEvmChainIds = useAllEvmChainIds()

  // --- Raw position fetching ---
  const { data: infinityCLAll, pending: p1 } = useAccountInfinityCLPositions(allEvmChainIds, account)
  const { data: infinityBinAll, pending: p2 } = useAccountInfinityBinPositions(account, allEvmChainIds)
  const { data: v3All, pending: p3 } = useAccountV3Positions(allEvmChainIds, account)
  const { data: v2All, pending: p4 } = useAccountV2LpDetails(allEvmChainIds, account)
  const { data: stableAll, pending: p5 } = useAccountStableLpDetails(allEvmChainIds, account)
  const { data: infinityStableAll, pending: p6 } = useAccountInfinityStablePositions(allEvmChainIds, account)

  const isLoading = p1 || p2 || p3 || p4 || p5 || p6

  const { data: farmsMap } = useQuery({
    queryKey: ['fetchAllUniversalFarmsMap'],
    queryFn: fetchAllUniversalFarmsMap,
    staleTime: 60_000,
  })

  // --- Infinity: positions on current chain with liquidity ---
  const infinityPositions = useMemo(
    () =>
      [...(infinityCLAll ?? []), ...(infinityBinAll ?? [])].filter(
        (p): p is InfinityCLPositionDetail | InfinityBinPositionDetail => p.chainId === chainId && p.liquidity > 0n,
      ),
    [infinityCLAll, infinityBinAll, chainId],
  )

  // --- Infinity earnings from API (aggregate, for panel total) ---
  const { totalUnclaimedRewards } = useUserAllFarmRewardsByChainIdFromAPI({ chainId, user: account })

  const infinityTotalUSD = useMemo(() => {
    if (!totalUnclaimedRewards) return 0
    return totalUnclaimedRewards
      .reduce((acc, item) => new BigNumber(item.totalReward).plus(acc), new BigNumber(0))
      .times(cakePrice)
      .toNumber()
  }, [totalUnclaimedRewards, cakePrice])

  // --- Per-position Infinity earnings: fetch ALL pool rewards in one call ---
  // usePoolFarmRewardsFormAPI without poolId → calls /farms/user-rewards/{chainId}/{address}
  // which returns per-pool, per-tokenId reward data for all positions at once.
  const hourTimestamp = useMemo(() => dayjs().startOf('hour').unix(), [])
  const { data: allPoolRewards } = usePoolFarmRewardsFormAPI({
    chainId,
    address: account,
    timestamp: hourTimestamp,
  })

  // Build a map: poolId → tokenId → cakeAmount (human-readable)
  const infinityEarningsMap = useMemo(() => {
    if (!allPoolRewards || !chainId) return {}
    // allPoolRewards items: { poolId, campaignId, tokenIds[], rewardAmounts[], rewardTokenAddress }
    const map: Record<string, Record<string, number>> = {}
    for (const reward of allPoolRewards) {
      const { poolId, tokenIds, rewardAmounts, rewardTokenAddress } = reward
      const token = getTokenByAddress(chainId, rewardTokenAddress)
      const decimals = token?.decimals ?? 18
      if (!map[poolId]) map[poolId] = {}
      tokenIds.forEach((tokenId, idx) => {
        const humanAmount = new BigNumber(rewardAmounts[idx]).div(new BigNumber(10).pow(decimals)).toNumber()
        map[poolId][tokenId] = (map[poolId][tokenId] ?? 0) + humanAmount
      })
    }
    return map
  }, [allPoolRewards, chainId])

  // --- Infinity positions enriched with per-position earnings ---
  const infinityHarvestPositions = useMemo((): InfinityHarvestPositionEnriched[] => {
    return infinityPositions.map((pos) => {
      let cakeAmount = 0
      const poolMap = infinityEarningsMap[pos.poolId]
      if (poolMap) {
        if (pos.protocol === Protocol.InfinityCLAMM) {
          const clPos = pos as InfinityCLPositionDetail
          // Sum all tokenId entries that match this position's tokenId
          cakeAmount = poolMap[clPos.tokenId.toString()] ?? 0
        } else {
          // BIN: sum all tokenId entries for this pool (one user = one position per pool)
          cakeAmount = Object.values(poolMap).reduce((acc, v) => acc + v, 0)
        }
      }
      const earningsUSD =
        cakeAmount > 0 && cakePrice.gt(0) ? new BigNumber(cakeAmount).times(cakePrice.toString()).toNumber() : 0
      return { position: pos, earningsUSD, cakeAmount }
    })
  }, [infinityPositions, infinityEarningsMap, cakePrice])

  // --- V3: staked on current chain ---
  const v3StakedPositions = useMemo(
    () =>
      v3All.filter(
        (p): p is PositionDetail =>
          !isSolana(p.chainId) && p.chainId === chainId && Boolean(p.isStaked) && p.tokenId !== undefined,
      ),
    [v3All, chainId],
  )

  const v3StakedTokenIds = useMemo(() => v3StakedPositions.map((p) => p.tokenId!.toString()), [v3StakedPositions])

  const stakedBigIntIds = useMemo(
    () => v3StakedPositions.map((p) => BigInt(p.tokenId!.toString())),
    [v3StakedPositions],
  )

  const { tokenIdResults: v3PendingCakes, isLoading: v3EarningsLoading } = useStakedPositionsByUser(
    stakedBigIntIds,
    chainId,
  )

  const v3HarvestPositions = useMemo((): V3HarvestPositionEnriched[] => {
    return v3StakedPositions.map((pos, idx) => {
      const pendingCake = v3PendingCakes?.[idx] ?? 0n
      const amount = +formatBigInt(pendingCake, 5)
      const usd = new BigNumber(amount).times(cakePrice.toString()).toNumber()
      return { position: pos, pendingCakeAmount: amount, earningsUSD: usd }
    })
  }, [v3StakedPositions, v3PendingCakes, cakePrice])

  // --- V2: staked on current chain ---
  const v2Positions = useMemo(
    () => v2All.filter((p) => p.pair.chainId === chainId && Boolean(p.isStaked) && p.farmingBalance.greaterThan(0)),
    [v2All, chainId],
  )

  // --- Stable: staked on current chain (regular + Infinity stable) ---
  const stablePositions = useMemo(() => {
    const all = [...stableAll, ...infinityStableAll]
    return all.filter(
      (p) => p.pair.liquidityToken.chainId === chainId && Boolean(p.isStaked) && p.farmingBalance.greaterThan(0),
    )
  }, [stableAll, infinityStableAll, chainId])

  // --- V2/Stable harvest targets ---
  const v2Targets = useMemo((): V2HarvestTarget[] => {
    if (!farmsMap || !chainId) return []
    const targets: V2HarvestTarget[] = []
    const addTarget = (key: string, lpAddress: string) => {
      const configKey = `${lpAddress.toLowerCase()}-${chainId}`
      const farmConfig = farmsMap[configKey] as
        | ({ bCakeWrapperAddress?: Address } & (V2PoolInfo | StablePoolInfo))
        | undefined
      if (!farmConfig?.bCakeWrapperAddress) return
      targets.push({
        key,
        lpAddress: lpAddress as Address,
        bCakeWrapperAddress: farmConfig.bCakeWrapperAddress,
        onHarvest: async () => undefined,
      })
    }
    for (const pos of v2Positions) {
      const lp = pos.pair?.liquidityToken?.address
      if (lp) addTarget(`v2-${lp}`, lp)
    }
    for (const pos of stablePositions) {
      const lp: string | undefined = (pos as any).pair?.stableSwapAddress ?? pos.pair?.liquidityToken?.address
      if (lp) addTarget(`ss-${lp}`, lp)
    }
    return targets
  }, [v2Positions, stablePositions, farmsMap, chainId])

  // --- Other EVM chains with staked positions ---
  const otherChainsWithRewards = useMemo(() => {
    if (!chainId) return []
    const others = new Set<number>()
    for (const p of v3All) {
      if (p.chainId !== chainId && !isSolana(p.chainId) && p.isStaked) others.add(p.chainId)
    }
    for (const p of [...(infinityCLAll ?? []), ...(infinityBinAll ?? [])]) {
      if (p.chainId !== chainId && !isSolana(p.chainId) && p.liquidity > 0n) others.add(p.chainId)
    }
    return Array.from(others)
  }, [v3All, infinityCLAll, infinityBinAll, chainId])

  const v3TotalEarningsUSD = useMemo(
    () => v3HarvestPositions.reduce((acc, p) => acc + p.earningsUSD, 0),
    [v3HarvestPositions],
  )

  const evmTotalEarningsUSD = infinityTotalUSD + v3TotalEarningsUSD

  // Solana placeholder
  const solanaPositions = useMemo((): SolanaPositionItem[] => [], [])
  const solanaHarvestTargets = useMemo((): SolanaHarvestTarget[] => [], [])

  return {
    v3HarvestPositions,
    infinityHarvestPositions,
    v2Positions,
    stablePositions,
    evmTotalEarningsUSD,
    v3StakedTokenIds,
    v2Targets,
    otherChainsWithRewards,
    solanaPositions,
    solanaTotalEarningsUSD: 0,
    solanaHarvestTargets,
    totalEarningsUSD: evmTotalEarningsUSD,
    isLoading: isLoading || v3EarningsLoading,
  }
}
