import { useTranslation } from '@pancakeswap/localization'
import { Button, FlexGap, Message, MessageText, PreTitle, Text } from '@pancakeswap/uikit'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { LightGreyCard } from '@pancakeswap/widgets-internal'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { HarvestTxStatus, harvestTxMapAtom, harvestingAtom } from './state/atoms'
import { useSolanaHarvestAll, type SolanaHarvestTarget } from './hooks/useSolanaHarvestAll'
import { PositionCard, type RewardInfo } from './shared/PositionCard'

export interface SolanaPositionItem {
  key: string
  currency0: any
  currency1: any
  tokenId?: string
  earningsUSD: number
  rewards: RewardInfo[]
}

interface SolanaHarvestPanelProps {
  positions: SolanaPositionItem[]
  totalEarningsUSD: number
  harvestTargets: SolanaHarvestTarget[]
}

export function SolanaHarvestPanel({ positions, totalEarningsUSD, harvestTargets }: SolanaHarvestPanelProps) {
  const { t } = useTranslation()
  const txMap = useAtomValue(harvestTxMapAtom)
  const harvesting = useAtomValue(harvestingAtom)

  const { harvestAll, retryFailed } = useSolanaHarvestAll(harvestTargets)

  const hasStarted = useMemo(() => positions.some((pos) => txMap[pos.key] !== undefined), [txMap, positions])
  const allSucceeded = useMemo(
    () => hasStarted && positions.every((pos) => txMap[pos.key]?.status === HarvestTxStatus.Success),
    [txMap, positions, hasStarted],
  )
  const failedCount = useMemo(
    () => positions.filter((pos) => txMap[pos.key]?.status === HarvestTxStatus.Failed).length,
    [txMap, positions],
  )

  const noRewards = positions.length === 0

  return (
    <LightGreyCard padding="16px" borderRadius="24px" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <FlexGap justifyContent="space-between" alignItems="center" mb="12px">
        <PreTitle color="secondary">{t('SOLANA POSITIONS')}</PreTitle>
        <Text bold fontSize="16px">
          {formatFiatNumber(totalEarningsUSD)}
        </Text>
      </FlexGap>

      {noRewards ? (
        <Text color="textSubtle" textAlign="center" py="16px" fontSize="14px">
          {t('No farm rewards to harvest')}
        </Text>
      ) : (
        <>
          <FlexGap flexDirection="column" gap="0px">
            {positions.map((pos, idx) => (
              <PositionCard
                key={pos.key}
                currency0={pos.currency0}
                currency1={pos.currency1}
                tokenId={pos.tokenId}
                earningsUSD={pos.earningsUSD}
                rewards={pos.rewards}
                status={txMap[pos.key]?.status}
                isLast={idx === positions.length - 1}
              />
            ))}
          </FlexGap>

          {!hasStarted && (
            <Button mt="12px" width="100%" variant="secondary" disabled={harvesting || noRewards} onClick={harvestAll}>
              {t('Harvest all')}
            </Button>
          )}

          {harvesting && !allSucceeded && (
            <Button mt="12px" width="100%" variant="secondary" disabled>
              {t('Harvesting')}
            </Button>
          )}

          {allSucceeded && (
            <Button mt="12px" width="100%" variant="secondary" disabled>
              {t('Harvested')}
            </Button>
          )}

          {failedCount > 0 && !harvesting && (
            <>
              <Button mt="12px" width="100%" variant="secondary" onClick={retryFailed}>
                {t('Retry')}
              </Button>
              <Message variant="warning" mt="12px">
                <MessageText>{t('An error occurred during the harvest, please try again')}</MessageText>
              </Message>
            </>
          )}
        </>
      )}
    </LightGreyCard>
  )
}
