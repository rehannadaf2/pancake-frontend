import { createContext, useContext } from 'react'

/**
 * Shared context that lets any position action button open the centralised
 * HarvestEarningsModal without prop-drilling through the positions table tree.
 */
export const HarvestModalContext = createContext<(() => void) | null>(null)

export function useOpenHarvestModal(): (() => void) | null {
  return useContext(HarvestModalContext)
}
