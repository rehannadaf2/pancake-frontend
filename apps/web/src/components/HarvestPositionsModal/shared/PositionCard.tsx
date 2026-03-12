import { UnifiedCurrency } from '@pancakeswap/sdk'
import { Currency } from '@pancakeswap/swap-sdk-core'
import { FlexGap, Text } from '@pancakeswap/uikit'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { DoubleCurrencyLogo } from '@pancakeswap/widgets-internal'
import styled from 'styled-components'
import { HarvestTxStatus } from '../state/atoms'
import { HarvestStatusIndicator } from './HarvestStatusIndicator'

export interface RewardInfo {
  currency: Currency | UnifiedCurrency
  amount: number | string
}

interface PositionCardProps {
  currency0: Currency | UnifiedCurrency
  currency1: Currency | UnifiedCurrency
  tokenId?: string | number
  earningsUSD: number
  rewards: RewardInfo[]
  status?: HarvestTxStatus
  isLast?: boolean
}

const CardRow = styled(FlexGap)<{ $isLast?: boolean }>`
  border-bottom: ${({ $isLast, theme }) => ($isLast ? 'none' : `1px solid ${theme.colors.cardBorder}`)};
`

export function PositionCard({
  currency0,
  currency1,
  tokenId,
  earningsUSD,
  rewards,
  status,
  isLast,
}: PositionCardProps) {
  return (
    <CardRow
      $isLast={isLast}
      flexDirection="row"
      justifyContent="space-between"
      alignItems="flex-start"
      gap="8px"
      py="8px"
    >
      <FlexGap gap="8px" alignItems="flex-start" flex="1" minWidth="0">
        {status && status !== HarvestTxStatus.Idle && <HarvestStatusIndicator status={status} />}
        <DoubleCurrencyLogo currency0={currency0} currency1={currency1} size={24} innerMargin="-4px" />

        <Text fontSize="14px" bold>
          {currency0.symbol} / {currency1.symbol}
          {tokenId ? (
            <Text as="span" fontSize="14px" color="textSubtle">
              {' '}
              #{String(tokenId)}
            </Text>
          ) : null}
        </Text>
      </FlexGap>
      <FlexGap flexDirection="column" alignItems="flex-end" gap="1px" minWidth="0">
        <Text fontSize="14px" bold style={{ flexShrink: 0 }}>
          {formatFiatNumber(earningsUSD)}
        </Text>
        {rewards.length > 0 && (
          <FlexGap gap="4px">
            <Text fontSize="12px" color="textSubtle">
              {rewards.map((reward, idx) => (
                <span key={reward.currency.symbol ?? idx}>
                  {idx > 0 && ' + '}
                  {formatNumber(reward.amount)} {reward.currency.symbol}
                </span>
              ))}
            </Text>
          </FlexGap>
        )}
      </FlexGap>
    </CardRow>
  )
}
