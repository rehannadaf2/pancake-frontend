import { ChainId } from '@pancakeswap/chains'
import { ERC20Token, Native } from '@pancakeswap/sdk'
import { isAddressEqual, zeroAddress } from 'viem'
import { FARMS_API } from '../config/endpoint'
import { Protocol, UniversalFarmConfig } from './types'

const farmCache: Record<string, UniversalFarmConfig[]> = {}
const farmPromiseCache: Record<string, Promise<UniversalFarmConfig[]> | undefined> = {}

export const fetchUniversalFarms = async (chainId: ChainId, protocol?: Protocol) => {
  const cacheKey = `${chainId}-${protocol || 'all'}`

  // Return cached data if it exists
  if (farmCache[cacheKey]) {
    return farmCache[cacheKey]
  }

  if (farmPromiseCache[cacheKey]) {
    return farmPromiseCache[cacheKey]
  }

  const allKey = `${chainId}-all`

  if (protocol && (farmCache[allKey] || farmPromiseCache[allKey])) {
    const filterAndCache = (allFarms: UniversalFarmConfig[]) => {
      const filtered = allFarms.filter((farm) => farm.protocol === protocol)
      farmCache[cacheKey] = filtered
      return filtered
    }

    if (farmPromiseCache[allKey]) {
      farmPromiseCache[cacheKey] = farmPromiseCache[allKey].then(filterAndCache)
      return farmPromiseCache[cacheKey]
    }

    return filterAndCache(farmCache[allKey])
  }

  const fetchPromise = (async () => {
    try {
      const params = { chainId, ...(protocol && { protocol }) }
      const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&')

      const response = await fetch(`${FARMS_API}?${queryString}`, {
        signal: AbortSignal.timeout(3000),
      })

      const result = await response.json()
      const newData: UniversalFarmConfig[] = result.map((p: any) => ({
        ...p,
        lpAddress: p.lpAddress ?? p.poolId,
        token0: isAddressEqual(p.token0.address, zeroAddress)
          ? Native.onChain(chainId)
          : new ERC20Token(
              p.token0.chainId,
              p.token0.address,
              p.token0.decimals,
              p.token0.symbol,
              p.token0.name,
              p.token0.projectLink,
            ),
        token1: new ERC20Token(
          p.token1.chainId,
          p.token1.address,
          p.token1.decimals,
          p.token1.symbol,
          p.token1.name,
          p.token1.projectLink,
        ),
      }))

      farmCache[cacheKey] = newData
      return newData
    } catch (error) {
      return []
    } finally {
      delete farmPromiseCache[cacheKey]
    }
  })()

  farmPromiseCache[cacheKey] = fetchPromise
  return fetchPromise
}
