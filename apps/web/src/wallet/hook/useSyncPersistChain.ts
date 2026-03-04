import { useRouter } from 'next/router'
import { allCasesNameToChainId } from '@pancakeswap/chains'
import { useSwitchNetworkV2 } from './useSwitchNetworkV2'

let switchPromise: Promise<boolean> | null = null
let resolvedChainId: number | null = null

export const useSyncPersistChain = () => {
  const router = useRouter()
  const { query } = router
  const chain = (query.chain || '') as string
  const persistChain = query.persistChain ? String(query.persistChain) : null
  const { switchNetwork } = useSwitchNetworkV2()

  const targetChainId = chain ? allCasesNameToChainId[chain] : null
  const shouldSync = !!targetChainId && !!persistChain && resolvedChainId !== targetChainId

  if (shouldSync) {
    if (!switchPromise) {
      switchPromise = switchNetwork(targetChainId).then((result) => {
        resolvedChainId = targetChainId
        switchPromise = null
        return result
      })
    }
    throw switchPromise
  }

  return null
}
