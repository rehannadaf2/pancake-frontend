import { useTranslation } from '@pancakeswap/localization'
import {
  CircleLoader,
  Dots,
  FlexGap,
  Loading,
  ModalV2,
  ModalV2Props,
  MotionModal,
  Spinner,
  SwapSpinner,
  Text,
} from '@pancakeswap/uikit'
import { useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { resetHarvestStatusAtom } from './state/atoms'
import { EvmHarvestPanel } from './EvmHarvestPanel'
import { SolanaHarvestPanel } from './SolanaHarvestPanel'
import { useHarvestModalData } from './hooks/useHarvestModalData'

export { useHarvestModalData } from './hooks/useHarvestModalData'
export { TotalEarningsBanner } from './TotalEarningsBanner'
export { HarvestModalContext, useOpenHarvestModal } from './HarvestModalContext'

interface HarvestEarningsModalProps extends Pick<ModalV2Props, 'isOpen' | 'onDismiss'> {}

export function HarvestEarningsModal({ isOpen, onDismiss }: HarvestEarningsModalProps) {
  const { t } = useTranslation()
  const resetStatus = useSetAtom(resetHarvestStatusAtom)
  const { publicKey: solanaPublicKey } = useWallet()
  const { switchNetwork } = useSwitchNetwork()

  const hasSolanaWallet = Boolean(solanaPublicKey)

  const {
    v3HarvestPositions,
    infinityHarvestPositions,
    v2Positions,
    stablePositions,
    evmTotalEarningsUSD,
    v3StakedTokenIds,
    v2Targets,
    otherChainsWithRewards,
    solanaPositions,
    solanaTotalEarningsUSD,
    solanaHarvestTargets,
    isLoading,
  } = useHarvestModalData()

  const handleDismiss = useCallback(() => {
    onDismiss?.()
  }, [onDismiss])

  const handleSwitchChain = useCallback(
    (chainId: number) => {
      resetStatus()
      switchNetwork(chainId)
    },
    [resetStatus, switchNetwork],
  )

  return (
    <ModalV2 isOpen={isOpen} onDismiss={handleDismiss} closeOnOverlayClick>
      <MotionModal
        title={t('Harvest Earnings')}
        headerBorderColor="transparent"
        bodyPadding="0 24px 16px"
        onDismiss={handleDismiss}
        width="480px"
      >
        {isLoading ? (
          <FlexGap alignItems="center" gap="12px" mx="auto" mt="48px">
            <CircleLoader size="20px" />
            <Text color="textSubtle" textAlign="center" fontSize="14px">
              <Dots>{t('Loading positions')}</Dots>
            </Text>
          </FlexGap>
        ) : (
          <FlexGap flexDirection="column" gap="16px">
            {hasSolanaWallet && (
              <SolanaHarvestPanel
                positions={solanaPositions}
                totalEarningsUSD={solanaTotalEarningsUSD}
                harvestTargets={solanaHarvestTargets}
              />
            )}

            <EvmHarvestPanel
              v3HarvestPositions={v3HarvestPositions}
              infinityHarvestPositions={infinityHarvestPositions}
              v2Positions={v2Positions}
              stablePositions={stablePositions}
              totalEarningsUSD={evmTotalEarningsUSD}
              v3StakedTokenIds={v3StakedTokenIds}
              v2Targets={v2Targets}
              otherChainsWithRewards={otherChainsWithRewards}
              onSwitchChain={handleSwitchChain}
            />
          </FlexGap>
        )}
      </MotionModal>
    </ModalV2>
  )
}
