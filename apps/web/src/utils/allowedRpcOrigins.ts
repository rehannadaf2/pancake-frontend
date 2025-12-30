import { PUBLIC_NODES } from 'config/nodes'

type SolanaRpcConf = {
  url?: string
  name?: string
  weight?: number
  batch?: boolean
}

function buildAllowedRpcOrigins(): string[] {
  const urls = Object.values(PUBLIC_NODES).flat().filter(Boolean)

  const origins = new Set<string>()

  for (const url of urls) {
    try {
      origins.add(new URL(url).origin)
    } catch {
      // ignore invalid URLs
    }
  }

  return Array.from(origins)
}

function getSolanaRpcOrigins(): string[] {
  try {
    const raw = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT_CONF
    if (!raw) return []

    const parsed = JSON.parse(raw) as SolanaRpcConf[]
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((entry) => entry?.url)
      .filter((url): url is string => typeof url === 'string' && url.startsWith('http'))
  } catch {
    return []
  }
}

export function buildAllowedOrigins(): readonly string[] {
  return Object.freeze(
    [
      ...buildAllowedRpcOrigins(),

      // ---- Solana ----
      'https://api.mainnet-beta.solana.com',
      ...getSolanaRpcOrigins(),

      // ---- Wildcards ----
      'https://*.orbs.network',
      'https://*.browser-intake-datadoghq.com',
      'https://*.privy.io',
      'https://*.googleapis.com',
      'https://*.google-analytics.com',
      'https://*.sentry.io',
      'https://*.discord.com',
      'https://*.twitter.com',
      'https://*.telegram.org',
      'https://*.jup.ag',
      'https://*.walletconnect.org',
      'https://*.walletconnect.com',
      'https://*.pancakeswap.com',
      'https://*.pancakeswap.finance',
      'https://*.pancake.run',
      'https://*.raydium.io',
      'https://*.coingecko.com',
      'https://*.thegraph.com',
      'https://*.snapshot.org',
      'https://*.ankr.com',
      'https://*.nodereal.io',
      'https://*.bscrpc.com',
      'https://*.ninicoin.io',
      'https://*.binance.com',

      // ---- Local dev ----
      ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'ws://localhost:3000'] : []),
    ].filter(Boolean),
  )
}
