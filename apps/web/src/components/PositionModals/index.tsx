import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { FlexGap, Modal, ModalV2, PreTitle } from '@pancakeswap/uikit'
import { Hex } from 'viem'
import { isInfinityProtocol } from 'utils/protocols'
import { useCallback, useState } from 'react'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  UnifiedPositionDetail,
} from 'state/farmsV4/state/accountPositions/type'
import { InfinityPositionModalContent } from './Infinity'
import { PositionTabType } from './types'

interface PositionModalProps {
  isOpen?: boolean
  onDismiss?: () => void

  poolId: string | undefined
  protocol: Protocol | undefined
  position: UnifiedPositionDetail

  chainId?: number
  presetTab?: PositionTabType
}
export function PositionModal({
  isOpen,
  onDismiss,
  protocol,
  poolId,
  chainId,
  position,
  presetTab,
}: PositionModalProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<PositionTabType>(presetTab ?? 'Add')

  const handleTabSelect = useCallback(
    (tab: PositionTabType) => {
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
        bodyPadding="0 24px 16px"
        onDismiss={onDismiss}
        minWidth="438px"
      >
        <FlexGap gap="16px" mb="16px">
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
          <InfinityPositionModalContent
            poolId={poolId as Hex}
            chainId={chainId}
            tab={tab}
            position={position as InfinityCLPositionDetail | InfinityBinPositionDetail}
          />
        ) : (
          'protocol not supported (testing)'
        )}
      </Modal>
    </ModalV2>
  )
}
