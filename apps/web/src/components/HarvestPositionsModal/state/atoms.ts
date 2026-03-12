import { atom } from 'jotai'

export enum HarvestTxStatus {
  Idle = 'idle',
  Pending = 'pending',
  Success = 'success',
  Failed = 'failed',
}

export interface HarvestTxState {
  status: HarvestTxStatus
  hash?: string
  error?: string
}

export const harvestTxMapAtom = atom<Record<string, HarvestTxState>>({})

export const harvestingAtom = atom(false)

export const setHarvestStatusAtom = atom(
  null,
  (get, set, update: { key: string; status: HarvestTxStatus; hash?: string; error?: string }) => {
    const prev = get(harvestTxMapAtom)
    set(harvestTxMapAtom, {
      ...prev,
      [update.key]: {
        status: update.status,
        hash: update.hash ?? prev[update.key]?.hash,
        error: update.error,
      },
    })
  },
)

export const resetHarvestStatusAtom = atom(null, (_get, set) => {
  set(harvestTxMapAtom, {})
})
