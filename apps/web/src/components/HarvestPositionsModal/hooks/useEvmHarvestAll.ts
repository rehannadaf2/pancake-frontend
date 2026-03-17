import { INFI_FARMING_DISTRIBUTOR_ADDRESSES, encodeClaimCalldata } from '@pancakeswap/infinity-sdk'
import { MasterChefV3 } from '@pancakeswap/v3-sdk'
import { useCallback, useMemo } from 'react'
import { Address, Hex, createWalletClient, custom, encodeFunctionData, hexToBigInt } from 'viem'
import { eip5792Actions } from 'viem/experimental'
import { useAccount, useSendTransaction, useWalletClient } from 'wagmi'
import { useSetAtom } from 'jotai'
import { ChainId as EvmChainId } from '@pancakeswap/chains'

import { useActiveChainId } from 'hooks/useActiveChainId'
import { useEIP5792Status } from 'hooks/useIsEIP5792Supported'
import { useMasterchefV3 } from 'hooks/useContract'
import { useUserAllFarmRewardsByChainIdFromAPI } from 'hooks/infinity/useFarmReward'
import useCatchTxError from 'hooks/useCatchTxError'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { RetryableError, retry } from 'state/multicall/retry'
import { calculateGasMargin } from 'utils'
import { publicClient as getPublicClient } from 'utils/viem'

import { HarvestTxStatus, setHarvestStatusAtom, harvestingAtom, resetHarvestStatusAtom } from '../state/atoms'

interface BatchCall {
  to: Address
  value: bigint
  data: Hex
}

export interface V2HarvestTarget {
  key: string
  lpAddress: Address
  bCakeWrapperAddress: Address
}

interface UseEvmHarvestAllParams {
  v3StakedTokenIds: string[]
  v2Targets: V2HarvestTarget[]
}

export function useEvmHarvestAll({ v3StakedTokenIds, v2Targets }: UseEvmHarvestAllParams) {
  const { chainId } = useActiveChainId()
  const { address: account, connector } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId })
  const { sendTransactionAsync } = useSendTransaction()
  const eip5792Status = useEIP5792Status()
  const masterChefV3Address = useMasterchefV3()?.address as Address | undefined
  const [, setLatestTxReceipt] = useLatestTxReceipt()
  const { fetchWithCatchTxError } = useCatchTxError()

  const setStatus = useSetAtom(setHarvestStatusAtom)
  const setHarvesting = useSetAtom(harvestingAtom)
  const resetStatus = useSetAtom(resetHarvestStatusAtom)

  const { allRewards, totalUnclaimedRewards } = useUserAllFarmRewardsByChainIdFromAPI({
    chainId,
    user: account,
  })

  const hasInfinityRewards = useMemo(
    () => totalUnclaimedRewards?.some((r) => Number(r.totalReward) > 0),
    [totalUnclaimedRewards],
  )
  const hasV3Rewards = v3StakedTokenIds.length > 0
  const hasV2Rewards = v2Targets.length > 0

  const isEip5792Ready = useMemo(
    () => eip5792Status === 'ready' && chainId !== EvmChainId.BASE,
    [eip5792Status, chainId],
  )

  const txCount = useMemo(() => {
    if (!chainId) return 0
    if (isEip5792Ready) return 1

    let count = 0
    if (hasInfinityRewards) count += 1
    if (hasV3Rewards) count += 1
    count += v2Targets.length
    return count
  }, [chainId, isEip5792Ready, hasInfinityRewards, hasV3Rewards, v2Targets.length])

  const buildInfinityCalldata = useCallback((): BatchCall | null => {
    if (!account || !allRewards || !chainId || !hasInfinityRewards) return null

    const claimParams = allRewards.map(({ totalRewardAmount, rewardTokenAddress, proofs }) => ({
      proof: proofs,
      amount: BigInt(totalRewardAmount),
      token: rewardTokenAddress,
    }))
    const calldata = encodeClaimCalldata(claimParams)

    return {
      to: INFI_FARMING_DISTRIBUTOR_ADDRESSES[chainId] as Address,
      data: calldata,
      value: 0n,
    }
  }, [account, allRewards, chainId, hasInfinityRewards])

  const buildV3Calldata = useCallback((): BatchCall | null => {
    if (!account || !masterChefV3Address || !hasV3Rewards) return null

    const { calldata, value } = MasterChefV3.batchHarvestCallParameters(
      v3StakedTokenIds.map((tokenId) => ({ tokenId, to: account })),
    )

    return {
      to: masterChefV3Address,
      data: calldata as Hex,
      value: hexToBigInt(value),
    }
  }, [account, masterChefV3Address, hasV3Rewards, v3StakedTokenIds])

  const buildV2Calldatas = useCallback((): BatchCall[] => {
    return v2Targets.map((target) => ({
      to: target.bCakeWrapperAddress,
      data: encodeFunctionData({
        abi: [
          {
            name: 'deposit',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: '_amount', type: 'uint256' },
              { name: '_lock', type: 'bool' },
            ],
            outputs: [],
          },
        ],
        functionName: 'deposit',
        args: [0n, false],
      }),
      value: 0n,
    }))
  }, [v2Targets])

  const harvestBatched = useCallback(async () => {
    if (!walletClient || !connector || !chainId || !account) return

    const calls: BatchCall[] = []
    const keys: string[] = []

    const infinityCall = buildInfinityCalldata()
    if (infinityCall) {
      calls.push(infinityCall)
      keys.push(`infinity-${chainId}`)
    }

    const v3Call = buildV3Calldata()
    if (v3Call) {
      calls.push(v3Call)
      keys.push(`v3-${chainId}`)
    }

    const v2Calls = buildV2Calldatas()
    v2Calls.forEach((call, idx) => {
      calls.push(call)
      keys.push(v2Targets[idx].key)
    })

    if (calls.length === 0) return

    keys.forEach((key) => setStatus({ key, status: HarvestTxStatus.Pending }))

    try {
      const provider = await connector.getProvider()
      const client = createWalletClient({
        transport: custom(provider as any),
        account: walletClient.account,
        chain: walletClient.chain,
      }).extend(eip5792Actions())

      const result = await client.sendCalls({ calls, forceAtomic: true })

      if (!result.id) {
        keys.forEach((key) => setStatus({ key, status: HarvestTxStatus.Failed, error: 'No transaction ID returned' }))
        return
      }

      const { promise: statusPromise } = retry(
        async () => {
          const status = await client.getCallsStatus({ id: result.id })
          if (status.status === 'failure') throw new Error('Transaction failed')
          if (status.status !== 'success') throw new RetryableError()
          return status
        },
        { n: 20, minWait: 2000, maxWait: 4000 },
      )

      const status = await statusPromise
      const hash = status.receipts?.[0]?.transactionHash

      if (status.status === 'success') {
        keys.forEach((key) => setStatus({ key, status: HarvestTxStatus.Success, hash }))
        if (hash) {
          setLatestTxReceipt({ blockHash: hash, status: 'success' })
        }
      }
    } catch (error) {
      keys.forEach((key) =>
        setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message ?? 'Unknown error' }),
      )
    }
  }, [
    walletClient,
    connector,
    chainId,
    account,
    buildInfinityCalldata,
    buildV3Calldata,
    buildV2Calldatas,
    v2Targets,
    setStatus,
    setLatestTxReceipt,
  ])

  const sendTx = useCallback(
    async (call: BatchCall) => {
      if (!account || !chainId) return null
      const client = getPublicClient({ chainId })
      return fetchWithCatchTxError(() =>
        client.estimateGas({ account, ...call }).then((estimate) =>
          sendTransactionAsync({
            ...call,
            account,
            chainId,
            gas: calculateGasMargin(estimate),
          }),
        ),
      )
    },
    [account, chainId, fetchWithCatchTxError, sendTransactionAsync],
  )

  const harvestSequential = useCallback(async () => {
    if (!account || !chainId) return

    if (hasInfinityRewards) {
      const key = `infinity-${chainId}`
      setStatus({ key, status: HarvestTxStatus.Pending })
      try {
        const call = buildInfinityCalldata()
        if (call) {
          const receipt = await sendTx(call)
          if (receipt?.status) {
            setStatus({ key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
            setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
          } else {
            setStatus({ key, status: HarvestTxStatus.Failed })
          }
        }
      } catch (error) {
        setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
      }
    }

    if (hasV3Rewards && masterChefV3Address) {
      const key = `v3-${chainId}`
      setStatus({ key, status: HarvestTxStatus.Pending })
      try {
        const call = buildV3Calldata()
        if (call) {
          const receipt = await sendTx(call)
          if (receipt?.status) {
            setStatus({ key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
            setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
          } else {
            setStatus({ key, status: HarvestTxStatus.Failed })
          }
        }
      } catch (error) {
        setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
      }
    }

    const v2Calls = buildV2Calldatas()
    for (let i = 0; i < v2Targets.length; i++) {
      const target = v2Targets[i]
      const call = v2Calls[i]
      setStatus({ key: target.key, status: HarvestTxStatus.Pending })
      try {
        // eslint-disable-next-line no-await-in-loop
        const receipt = await sendTx(call)
        if (receipt?.status) {
          setStatus({ key: target.key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
          setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
        } else {
          setStatus({ key: target.key, status: HarvestTxStatus.Failed })
        }
      } catch (error) {
        setStatus({ key: target.key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
      }
    }
  }, [
    account,
    chainId,
    hasInfinityRewards,
    hasV3Rewards,
    masterChefV3Address,
    v2Targets,
    buildInfinityCalldata,
    buildV3Calldata,
    buildV2Calldatas,
    sendTx,
    setStatus,
    setLatestTxReceipt,
  ])

  const harvestAll = useCallback(async () => {
    if (!chainId) return
    resetStatus()
    setHarvesting(true)
    try {
      if (isEip5792Ready) {
        await harvestBatched()
      } else {
        await harvestSequential()
      }
    } finally {
      setHarvesting(false)
    }
  }, [chainId, isEip5792Ready, harvestBatched, harvestSequential, setHarvesting, resetStatus])

  const retryFailed = useCallback(async () => {
    if (!chainId || !account) return
    setHarvesting(true)

    try {
      if (hasInfinityRewards) {
        const key = `infinity-${chainId}`
        setStatus({ key, status: HarvestTxStatus.Pending })
        try {
          const call = buildInfinityCalldata()
          if (call) {
            const receipt = await sendTx(call)
            if (receipt?.status) {
              setStatus({ key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
            } else {
              setStatus({ key, status: HarvestTxStatus.Failed })
            }
          }
        } catch (error) {
          setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
        }
      }

      if (hasV3Rewards && masterChefV3Address) {
        const key = `v3-${chainId}`
        setStatus({ key, status: HarvestTxStatus.Pending })
        try {
          const call = buildV3Calldata()
          if (call) {
            const receipt = await sendTx(call)
            if (receipt?.status) {
              setStatus({ key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
            } else {
              setStatus({ key, status: HarvestTxStatus.Failed })
            }
          }
        } catch (error) {
          setStatus({ key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
        }
      }

      const v2Calls = buildV2Calldatas()
      for (let i = 0; i < v2Targets.length; i++) {
        const target = v2Targets[i]
        const call = v2Calls[i]
        setStatus({ key: target.key, status: HarvestTxStatus.Pending })
        try {
          // eslint-disable-next-line no-await-in-loop
          const receipt = await sendTx(call)
          if (receipt?.status) {
            setStatus({ key: target.key, status: HarvestTxStatus.Success, hash: receipt.transactionHash })
            setLatestTxReceipt({ blockHash: receipt.blockHash, status: receipt.status })
          } else {
            setStatus({ key: target.key, status: HarvestTxStatus.Failed })
          }
        } catch (error) {
          setStatus({ key: target.key, status: HarvestTxStatus.Failed, error: (error as Error)?.message })
        }
      }
    } finally {
      setHarvesting(false)
    }
  }, [
    chainId,
    account,
    hasInfinityRewards,
    hasV3Rewards,
    masterChefV3Address,
    v2Targets,
    buildInfinityCalldata,
    buildV3Calldata,
    buildV2Calldatas,
    sendTx,
    setStatus,
    setHarvesting,
    setLatestTxReceipt,
  ])

  return {
    harvestAll,
    retryFailed,
    txCount,
    hasInfinityRewards,
    hasV3Rewards,
    hasV2Rewards,
    isEip5792Ready,
  }
}
