import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { useHarvestRewardCallback } from 'hooks/solana/useHarvestRewardCallback'
import { SolanaV3PositionDetail } from 'state/farmsV4/state/accountPositions/type'
import { SolanaV3Pool } from 'state/pools/solana'

import { HarvestTxStatus, setHarvestStatusAtom, harvestingAtom } from '../state/atoms'

export interface SolanaHarvestTarget {
  key: string
  position: SolanaV3PositionDetail
  poolInfo: SolanaV3Pool
}

export function useSolanaHarvestAll(targets: SolanaHarvestTarget[]) {
  const harvestReward = useHarvestRewardCallback()
  const setStatus = useSetAtom(setHarvestStatusAtom)
  const setHarvesting = useSetAtom(harvestingAtom)

  const harvestAll = useCallback(async () => {
    if (targets.length === 0) return
    setHarvesting(true)

    for (const target of targets) {
      setStatus({ key: target.key, status: HarvestTxStatus.Pending })
      try {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve, reject) => {
          harvestReward({
            params: {
              poolInfo: target.poolInfo,
              position: target.position,
            },
            onSent: (txId) => {
              setStatus({ key: target.key, status: HarvestTxStatus.Pending, hash: txId })
            },
            onConfirmed: () => {
              setStatus({ key: target.key, status: HarvestTxStatus.Success })
              resolve()
            },
            onError: (error) => {
              setStatus({
                key: target.key,
                status: HarvestTxStatus.Failed,
                error: error?.message ?? 'Harvest failed',
              })
              reject(error)
            },
          })
        })
      } catch {
        // Status already set in onError callback
      }
    }

    setHarvesting(false)
  }, [targets, harvestReward, setStatus, setHarvesting])

  const retryFailed = useCallback(async () => {
    setHarvesting(true)

    for (const target of targets) {
      setStatus({ key: target.key, status: HarvestTxStatus.Pending })
      try {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve, reject) => {
          harvestReward({
            params: {
              poolInfo: target.poolInfo,
              position: target.position,
            },
            onSent: (txId) => {
              setStatus({ key: target.key, status: HarvestTxStatus.Pending, hash: txId })
            },
            onConfirmed: () => {
              setStatus({ key: target.key, status: HarvestTxStatus.Success })
              resolve()
            },
            onError: (error) => {
              setStatus({
                key: target.key,
                status: HarvestTxStatus.Failed,
                error: error?.message ?? 'Harvest failed',
              })
              reject(error)
            },
          })
        })
      } catch {
        // Status already set in onError callback
      }
    }

    setHarvesting(false)
  }, [targets, harvestReward, setStatus, setHarvesting])

  return {
    harvestAll,
    retryFailed,
    txCount: targets.length,
  }
}
