import { ChainId } from '@pancakeswap/chains'
import { useQuery } from '@tanstack/react-query'

type PrivySmartWalletResponse = {
  enabled: boolean
  smart_wallet_type: string
  configured_networks?: Array<{
    chain_id?: string
  }>
}

export function usePrivySupportedChainIds({ enabled = true }: { enabled?: boolean } = {}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  return useQuery({
    queryKey: ['privy', 'supported-chain-ids'],
    queryFn: async (): Promise<number[]> => {
      const res = await fetch(`https://auth.privy.io/api/v1/apps/${appId}/smart_wallets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'privy-app-id': appId!,
        },
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch Privy smart wallet config (${res.status})`)
      }

      const data = (await res.json()) as PrivySmartWalletResponse

      if (!data.enabled) return []

      if (!Array.isArray(data.configured_networks)) return []

      return data.configured_networks
        .map((network) => {
          if (!network || typeof network.chain_id !== 'string') return null
          const parts = network.chain_id.split(':')
          if (parts.length !== 2) return null
          const chainId = Number(parts[1])
          return Number.isFinite(chainId) ? chainId : null
        })
        .filter((id): id is number => id !== null)
        .sort((a, b) => {
          if (a === ChainId.BSC) return -1
          if (b === ChainId.BSC) return 1
          return a - b
        })
    },
    staleTime: Infinity,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled: Boolean(enabled && appId),
  })
}
