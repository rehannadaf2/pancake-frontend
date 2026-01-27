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
        try {
          sdk.actions.ready()
        } catch (error) {
          console.warn('[wallet] Base miniapp ready() failed', error)
        }
        await new Promise((resolve) => setTimeout(resolve, 100))

        const checkIsInMiniApp = async (attemptsLeft: number): Promise<boolean> => {
          const result = await sdk.isInMiniApp()
          if (cancelled || result || attemptsLeft <= 1) {
            return result
          }
          await new Promise((resolve) => setTimeout(resolve, 100))
          return checkIsInMiniApp(attemptsLeft - 1)
        }

        const isInMiniApp = await checkIsInMiniApp(3)
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
