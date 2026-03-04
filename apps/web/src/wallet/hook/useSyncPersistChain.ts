import { useRouter } from 'next/router'
import { allCasesNameToChainId } from '@pancakeswap/chains'
import { useSwitchNetworkV2 } from './useSwitchNetworkV2'

let switchPromise: Promise<void> | null = null
let switchPromiseChainId: number | null = null

export const useSyncPersistChain = () => {
  const router = useRouter()
  const { query } = router
  const chain = (query.chain || '') as string
  const persistChain = query.persistChain ? String(query.persistChain) : null
  const { switchNetwork } = useSwitchNetworkV2()

  const targetChainId = chain ? allCasesNameToChainId[chain] : null
  const shouldSync = !!targetChainId && !!persistChain

  if (shouldSync) {
    if (!switchPromise || switchPromiseChainId !== targetChainId) {
      switchPromiseChainId = targetChainId
      switchPromise = switchNetwork(targetChainId).then(() => {})
    }
    throw switchPromise
  }

  return null
}
