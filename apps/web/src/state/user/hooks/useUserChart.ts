import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const userChartAtom = atomWithStorage('pcs:tradingViewChartDisplay', false)

export function useUserChart() {
  return useAtom(userChartAtom)
}
