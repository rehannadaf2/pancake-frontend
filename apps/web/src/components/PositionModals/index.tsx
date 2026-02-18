import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { FlexGap, Modal, ModalV2, PreTitle } from '@pancakeswap/uikit'
import { Hex } from 'viem'
import { isInfinityProtocol } from 'utils/protocols'
import { useCallback, useState } from 'react'
import { InfinityPositionModalContent } from './IncreaseLiquidity/Infinity'

type TabType = 'Add' | 'Remove' | 'Harvest'

interface PositionModalProps {
  isOpen?: boolean
  onDismiss?: () => void

  poolId: string | undefined
  protocol: Protocol | undefined

  chainId?: number
  presetTab?: TabType
}
export function PositionModal({ isOpen, onDismiss, protocol, poolId, chainId, presetTab }: PositionModalProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabType>(presetTab ?? 'Add')

  const handleTabSelect = useCallback(
    (tab: TabType) => {
      setTab(tab)
    },
    [setTab],
  )

  if (!poolId || !protocol) return null

  return (
    <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
      <Modal
        title={t('Position Management')}
        headerBorderColor="transparent"
        bodyPadding="0 24px 0"
        onDismiss={onDismiss}
      >
        <FlexGap gap="8px" mb="16px">
          <PreTitle
            color={tab === 'Add' ? 'secondary' : 'textSubtle'}
            onClick={() => handleTabSelect('Add')}
            style={{ cursor: 'pointer' }}
          >
            {t('Add Liquidity')}
          </PreTitle>
          <PreTitle
            color={tab === 'Remove' ? 'secondary' : 'textSubtle'}
            onClick={() => handleTabSelect('Remove')}
            style={{ cursor: 'pointer' }}
          >
            {t('Remove Liquidity')}
          </PreTitle>
          <PreTitle
            color={tab === 'Harvest' ? 'secondary' : 'textSubtle'}
            onClick={() => handleTabSelect('Harvest')}
            style={{ cursor: 'pointer' }}
          >
            {t('Harvest')}
          </PreTitle>
        </FlexGap>
        {isInfinityProtocol(protocol) ? (
          <InfinityPositionModalContent poolId={poolId as Hex} chainId={chainId} />
        ) : (
          'protocol not supported (testing)'
        )}
      </Modal>
    </ModalV2>
  )
}
