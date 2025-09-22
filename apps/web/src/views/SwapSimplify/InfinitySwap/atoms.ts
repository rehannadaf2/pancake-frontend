import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

// Atom to manage the collapse state of the swap details panel
export const swapDetailsCollapseAtom = atom(false)
