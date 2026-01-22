import { ChainId } from '@pancakeswap/chains'
import { fetchUniversalFarms } from '../fetchUniversalFarms'
import { UniversalFarmConfig } from '../types'
import { getFarmConfigKey } from '../utils'
import { bscTestnetFarmConfig } from './bscTestnet'
import { monadTestnetFarmConfig } from './monad'
import { zkSyncTestnetFarmConfig } from './zkSyncTestnet'

const chainIds: ChainId[] = [
  ChainId.BSC,
  ChainId.ETHEREUM,
  ChainId.ZKSYNC,
  ChainId.ARBITRUM_ONE,
  ChainId.LINEA,
  ChainId.BASE,
  ChainId.OPBNB,
  ChainId.MONAD_MAINNET,
]

export const fetchAllUniversalFarms = async (chainId?: ChainId | ChainId[]): Promise<UniversalFarmConfig[]> => {
  try {
    const targetChainIds: ChainId[] = Array.isArray(chainId) ? chainId : chainId ? [chainId] : chainIds
    const farmPromises = targetChainIds.map((id) => fetchUniversalFarms(id))
    const results = await Promise.allSettled(farmPromises)
    const allFarms = results.flatMap((result) => {
      if (result.status === 'fulfilled') return result.value
      return []
    })
    const combinedFarms = allFarms.flat()

    return combinedFarms
  } catch (error) {
    return []
  }
}

export const fetchAllUniversalFarmsMap = async (): Promise<Record<string, UniversalFarmConfig>> => {
  try {
    const farmConfig = await fetchAllUniversalFarms()

    return farmConfig.reduce((acc, farm) => {
      const key = getFarmConfigKey(farm)
      // eslint-disable-next-line no-param-reassign
      acc[key] = farm
      return acc
    }, {} as Record<string, UniversalFarmConfig>)
  } catch (error) {
    console.error('Failed to fetch universal farms map:', error)
    return {}
  }
}

export const UNIVERSAL_FARMS_WITH_TESTNET: UniversalFarmConfig[] = [
  ...bscTestnetFarmConfig,
  ...zkSyncTestnetFarmConfig,
  ...monadTestnetFarmConfig,
]
