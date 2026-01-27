import { sdk } from '@farcaster/miniapp-sdk'
import { useEffect, useRef } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { farcasterMiniAppConnector } from 'utils/wagmi'

export const useBaseMiniAppAutoConnect = () => {
  const { address, connector, isConnected } = useAccount()
  const { connectAsync, isPending } = useConnect()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    if (checkedRef.current) return undefined
    if (isPending || address || connector || isConnected) {
      checkedRef.current = true
      return undefined
    }

    let cancelled = false

    const init = async () => {
      try {
        const isInMiniApp = await sdk.isInMiniApp()
        if (cancelled) return
        if (!isInMiniApp) {
          checkedRef.current = true
          return
        }

        checkedRef.current = true
        await connectAsync({ connector: farcasterMiniAppConnector })
      } catch (error) {
        checkedRef.current = true
        console.warn('[wallet] Base miniapp auto-connect failed', error)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [address, connector, connectAsync, isConnected, isPending])
}
