import { useTranslation } from '@pancakeswap/localization'
import { MultichainWalletModal } from '@pancakeswap/ui-wallets'
import { createQrCode, getDocLink } from 'config/wallet'
import { useActiveChainId } from 'hooks/useActiveChainId'
import useAuth from 'hooks/useAuth'

import { ChainId, isTestnetChainId } from '@pancakeswap/chains'
import { useFirebaseAuth } from 'wallet/Privy/firebase'
import { useCallback, useMemo } from 'react'
import { logGTMWalletConnectedEvent } from 'utils/customGTMEventTracking'
import { useConnect } from 'wagmi'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useWalletFilterEffect } from '@pancakeswap/ui-wallets/src/state/hooks'
import { usePrivySupportedChainIds } from 'hooks/usePrivySupportedChainIds'
import { useUserShowTestnet } from 'state/user/hooks/useUserShowTestnet'

const WalletModalManager: React.FC<{ isOpen: boolean; onDismiss?: () => void }> = ({ isOpen, onDismiss }) => {
  const { login } = useAuth()
  const { account: evmAccount, solanaAccount } = useAccountActiveChain()
  const {
    t,
    currentLanguage: { code },
  } = useTranslation()
  const { connectAsync } = useConnect()
  const { chainId } = useActiveChainId()

  const handleWalletConnect = useCallback(
    (connectedChainId: number | undefined, name?: string, address?: string) => {
      logGTMWalletConnectedEvent(connectedChainId ?? chainId, name, address)
    },
    [chainId],
  )

  const { loginWithGoogle, loginWithX, loginWithDiscord, loginWithTelegram } = useFirebaseAuth()

  const createEvmQrCode = useCallback(() => {
    return createQrCode(chainId || ChainId.BSC, connectAsync)
  }, [chainId, connectAsync])

  useWalletFilterEffect({ evmAddress: evmAccount ?? undefined, solanaAddress: solanaAccount ?? undefined })

  const { data: rawSupportedChains } = usePrivySupportedChainIds({ enabled: isOpen })
  const [userShowTestnet] = useUserShowTestnet()

  const supportedSocialLoginChains = useMemo(
    () =>
      rawSupportedChains
        ?.filter((chainId) => userShowTestnet || !isTestnetChainId(chainId))
        .sort((a, b) => {
          if (a === ChainId.BSC) return -1
          if (b === ChainId.BSC) return 1
          return a - b
        }),
    [rawSupportedChains, userShowTestnet],
  )

  return (
    <MultichainWalletModal
      evmAddress={evmAccount}
      solanaAddress={solanaAccount ?? undefined}
      chainId={chainId}
      docText={t('Learn How to Connect')}
      docLink={getDocLink(code)}
      isOpen={isOpen}
      evmLogin={login}
      createEvmQrCode={createEvmQrCode}
      onDismiss={onDismiss}
      onWalletConnectCallBack={handleWalletConnect}
      onGoogleLogin={loginWithGoogle}
      onXLogin={loginWithX}
      onTelegramLogin={loginWithTelegram}
      onDiscordLogin={loginWithDiscord}
      supportedSocialLoginChains={supportedSocialLoginChains}
    />
  )
}

export default WalletModalManager
