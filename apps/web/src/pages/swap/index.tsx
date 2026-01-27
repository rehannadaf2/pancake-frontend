import { Box, Skeleton, useMatchBreakpoints } from '@pancakeswap/uikit'
import { sdk } from '@farcaster/miniapp-sdk'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { NextPageWithLayout } from 'utils/page.types'
import { CHAIN_IDS } from 'utils/wagmi'
import SwapLayout from 'views/Swap/SwapLayout'
import SwapSimplify from 'views/SwapSimplify'
import { useWallets } from '@privy-io/react-auth'
import { useAccount, useConnect } from 'wagmi'

const StyledSkeleton = styled(Skeleton)`
  background: ${({ theme }) => theme.colors.backgroundBubblegum};
  opacity: 0.1;
`
const BgBox = styled(Box)`
  background: ${({ theme }) => theme.colors.backgroundBubblegum};
`
const Container = styled.div<{ isMobile: boolean }>`
  min-height: ${({ isMobile }) => (isMobile ? '100vh' : '100%')};
  background: ${({ theme }) => theme.colors.backgroundBubblegum};
`
const DebugPanel = styled.div`
  position: fixed;
  right: 12px;
  top: 88px;
  z-index: 1000;
  width: 300px;
  padding: 10px 12px;
  background: rgba(20, 20, 20, 0.92);
  color: #f4f4f4;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  pointer-events: none;
`
const SwapFallback = () => {
  const { isMobile } = useMatchBreakpoints()

  return (
    <BgBox
      style={{
        minHeight: isMobile ? '100vh' : '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <StyledSkeleton
        variant="rect"
        animation="waves"
        style={{
          minHeight: isMobile ? '100vh' : '100%',
        }}
      />
    </BgBox>
  )
}

const View = () => {
  const { isMobile } = useMatchBreakpoints()
  const { wallets } = useWallets()
  const { address, isConnected, connector, status } = useAccount()
  const { connectors, isPending } = useConnect()
  const [miniAppStatus, setMiniAppStatus] = useState<'checking' | 'yes' | 'no' | 'error'>('checking')
  const [miniAppError, setMiniAppError] = useState<string | null>(null)
  const showDebug = useMemo(() => {
    if (typeof window === 'undefined') return false
    return process.env.NODE_ENV !== 'production' || window.location.search.includes('miniappDebug=1')
  }, [])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const isInMiniApp = await sdk.isInMiniApp()
        if (cancelled) return
        setMiniAppStatus(isInMiniApp ? 'yes' : 'no')
      } catch (error) {
        if (cancelled) return
        setMiniAppStatus('error')
        setMiniAppError(error instanceof Error ? error.message : 'unknown error')
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  console.info(wallets, 'wallets')
  return (
    <SwapLayout>
      <Container isMobile={isMobile}>
        <SwapSimplify />
      </Container>
      {showDebug ? (
        <DebugPanel>
          <div>miniapp: {miniAppStatus}</div>
          {miniAppError ? <div>miniapp error: {miniAppError}</div> : null}
          <div>account status: {status}</div>
          <div>isConnected: {String(isConnected)}</div>
          <div>address: {address ?? '-'}</div>
          <div>connector: {connector?.id ?? '-'}</div>
          <div>connect pending: {String(isPending)}</div>
          <div>connectors: {connectors.map((c) => c.id).join(', ') || '-'}</div>
        </DebugPanel>
      ) : null}
    </SwapLayout>
  )
}

const SwapPage = dynamic(() => Promise.resolve(View), {
  ssr: false,
  loading: () => <SwapFallback />,
}) as NextPageWithLayout

SwapPage.chains = CHAIN_IDS
SwapPage.screen = true

export default SwapPage
