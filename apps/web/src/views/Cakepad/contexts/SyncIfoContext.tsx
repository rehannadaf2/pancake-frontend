import { useAtomValue, useSetAtom } from 'jotai'
import React, { useEffect } from 'react'
import { Flex, Spinner } from '@pancakeswap/uikit'
import { useIFOPoolInfoCtx } from '../hooks/ifo/useIFOPoolInfo'
import { ifoInfoAtom, ifoPoolsAtom, ifoUsersAtom } from '../atom/ifo.atoms'
import { useIFOInfoCtx } from '../hooks/ifo/useIFOInfo'
import { useIFOUserStatusCtx } from '../hooks/ifo/useIFOUserStatus'

export const SyncIfoContext = ({ id, children }: { id: string; children: React.ReactNode }) => {
  const pools = useIFOPoolInfoCtx()
  const updatePools = useSetAtom(ifoPoolsAtom(id))
  const updateInfo = useSetAtom(ifoInfoAtom(id))
  const updateUsers = useSetAtom(ifoUsersAtom(id))
  const info = useIFOInfoCtx()
  const { users, isLoading } = useIFOUserStatusCtx()
  const infoValue = useAtomValue(ifoInfoAtom(id))
  const poolsValue = useAtomValue(ifoPoolsAtom(id))
  useEffect(() => {
    if (pools) {
      updatePools(pools)
    }
  }, [pools])

  useEffect(() => {
    if (info && info.offeringCurrency) {
      updateInfo(info)
    }
  }, [info])

  useEffect(() => {
    updateUsers(users)
  }, [users])

  console.log('[ifo] SyncIfoContext rendered', { infoValue, poolsValue, isLoading })
  if (!infoValue || !poolsValue || !infoValue.offeringCurrency || isLoading) {
    return (
      <Flex width="100%" minHeight="600px" display="flex" alignItems="center" justifyContent="center">
        <Spinner />
      </Flex>
    )
  }
  return children
}
