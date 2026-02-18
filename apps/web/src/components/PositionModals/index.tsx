import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { Modal, ModalV2 } from '@pancakeswap/uikit'
import { Hex } from 'viem'
import { isInfinityProtocol } from 'utils/protocols'
import { InfinityPositionModalContent } from './Infinity'

interface PositionModalProps {
  isOpen?: boolean
  onDismiss?: () => void

  poolId: string | undefined
  protocol: Protocol | undefined

  chainId?: number
}
export function PositionModal({ isOpen, onDismiss, protocol, poolId, chainId }: PositionModalProps) {
  const { t } = useTranslation()

  if (!poolId || !protocol) return null

  return (
    <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
      <Modal
        title={t('Position Management')}
        onDismiss={onDismiss}
        headerBorderColor="transparent"
        bodyPadding="0 24px 0"
      >
        {isInfinityProtocol(protocol) ? (
          <InfinityPositionModalContent poolId={poolId as Hex} chainId={chainId} />
        ) : (
          'protocol not supported (testing)'
        )}
      </Modal>
    </ModalV2>
  )
}
