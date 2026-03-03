import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { FlexGap, ModalV2, MotionModal, PreTitle } from '@pancakeswap/uikit'
import { Hex } from 'viem'
import { isInfinityProtocol } from 'utils/protocols'
import { useCallback, useEffect, useState } from 'react'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  UnifiedPositionDetail,
  V2LPDetail,
} from 'state/farmsV4/state/accountPositions/type'
import styled from 'styled-components'
import { InfinityPositionModalContent } from './Infinity'
import { PositionTabType } from './types'
import { V3PositionModalContent } from './V3'
import { V2OrSSPositionModalContent } from './V2OrSS'

const ClickablePreTitle = styled(PreTitle)<{ $active?: boolean }>`
  cursor: pointer;
  transition: scale, opacity 0.15s;
  user-select: none;
  ${({ $active }) =>
    !$active &&
    `
      &:hover {
        opacity: 0.7;
      }
    `}
  &:active {
    transform: translateY(1px);
  }
`

const tabsOrder: PositionTabType[] = ['Add', 'Remove', 'Harvest']

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

  // Keyboard navigation for tabs
  useEffect(() => {
    if (typeof window !== 'undefined' && tab) {
      const onKeyDown = (e: KeyboardEvent) => {
        const index = tabsOrder.indexOf(tab)

        if (e.key === 'ArrowRight' && index + 1 < tabsOrder.length) {
          setTab(tabsOrder[index + 1])
        } else if (e.key === 'ArrowLeft' && index > 0) {
          setTab(tabsOrder[index - 1])
        }
      }

      document.addEventListener('keydown', onKeyDown)

      return () => {
        document.removeEventListener('keydown', onKeyDown)
      }
    }

    return () => {}
  }, [tab])

  if (!poolId || !protocol) return null

  return (
    <ModalV2 isOpen={isOpen} onDismiss={onDismiss} closeOnOverlayClick>
      <MotionModal
        title={t('Position Management')}
        headerBorderColor="transparent"
        bodyPadding="0 24px 16px"
        onDismiss={onDismiss}
        width="452px"
      >
        <FlexGap gap="16px" mb="16px">
          <ClickablePreTitle
            color={tab === 'Add' ? 'secondary' : 'textSubtle'}
            onClick={() => handleTabSelect('Add')}
            $active={tab === 'Add'}
          >
            {t('Add Liquidity')}
          </ClickablePreTitle>
          <ClickablePreTitle
            color={tab === 'Remove' ? 'secondary' : 'textSubtle'}
            onClick={() => handleTabSelect('Remove')}
            $active={tab === 'Remove'}
          >
            {t('Remove Liquidity')}
          </ClickablePreTitle>
          <ClickablePreTitle
            color={tab === 'Harvest' ? 'secondary' : 'textSubtle'}
            onClick={() => handleTabSelect('Harvest')}
            $active={tab === 'Harvest'}
          >
            {t('Harvest')}
          </ClickablePreTitle>
        </FlexGap>
        {isInfinityProtocol(protocol) ? (
          <InfinityPositionModalContent
            poolId={poolId as Hex}
            chainId={chainId}
            tab={tab}
            position={position as InfinityCLPositionDetail | InfinityBinPositionDetail}
          />
        ) : protocol === Protocol.V3 ? (
          <V3PositionModalContent
            poolId={poolId as Hex}
            chainId={chainId}
            tab={tab}
            position={position as InfinityCLPositionDetail}
          />
        ) : protocol === Protocol.V2 || protocol === Protocol.STABLE ? (
          <V2OrSSPositionModalContent
            poolId={poolId as Hex}
            chainId={chainId}
            tab={tab}
            position={position as V2LPDetail}
            protocol={protocol}
          />
        ) : (
          'protocol not supported (testing)'
        )}
        {/* TODO: StableSwap, InfinityBin */}
      </MotionModal>
    </ModalV2>
  )
}
