import { Protocol } from '@pancakeswap/farms'
import { chainNames } from '@pancakeswap/chains'
import { useTranslation } from '@pancakeswap/localization'
import { getTokenByAddress, CAKE } from '@pancakeswap/tokens'
import { Box, Button, FlexGap, Message, MessageText, PreTitle, Text } from '@pancakeswap/uikit'
import { formatFiatNumber } from '@pancakeswap/utils/formatFiatNumber'
import { LightGreyCard, Tips } from '@pancakeswap/widgets-internal'
import { useCurrencyByChainId } from 'hooks/Tokens'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { useActiveChainId } from 'hooks/useActiveChainId'
import type { InfinityCLPositionDetail, StableLPDetail, V2LPDetail } from 'state/farmsV4/state/accountPositions/type'
import { LinkText } from 'components/Liquidity/LinkText'
import { HarvestTxStatus, harvestTxMapAtom, harvestingAtom } from './state/atoms'
import { useEvmHarvestAll, type V2HarvestTarget } from './hooks/useEvmHarvestAll'
import type { V3HarvestPositionEnriched, InfinityHarvestPositionEnriched } from './hooks/useHarvestModalData'
import { PositionCard } from './shared/PositionCard'
import { VerticalList } from './shared/styles'

// --- Per-protocol row components ---

function V3HarvestRow({
  item,
  txMap,
  chainId,
  isLast,
}: {
  item: V3HarvestPositionEnriched
  txMap: Record<string, { status?: HarvestTxStatus }>
  chainId: number
  isLast?: boolean
}) {
  const { position, pendingCakeAmount, earningsUSD } = item
  const currency0 = getTokenByAddress(position.chainId, position.token0)
  const currency1 = getTokenByAddress(position.chainId, position.token1)
  const cake = CAKE[chainId]
  const txKey = `v3-${position.chainId}-${position.tokenId}`

  if (!currency0 || !currency1) return null

  return (
    <PositionCard
      currency0={currency0}
      currency1={currency1}
      tokenId={String(position.tokenId)}
      earningsUSD={earningsUSD}
      rewards={cake ? [{ currency: cake, amount: pendingCakeAmount }] : []}
      status={txMap[txKey]?.status}
      isLast={isLast}
    />
  )
}

function InfinityHarvestRow({
  item,
  txMap,
  isLast,
}: {
  item: InfinityHarvestPositionEnriched
  txMap: Record<string, { status?: HarvestTxStatus }>
  isLast?: boolean
}) {
  const { position, earningsUSD, cakeAmount } = item
  const { chainId } = position
  const currency0 = useCurrencyByChainId(position.poolKey?.currency0, chainId) ?? undefined
  const currency1 = useCurrencyByChainId(position.poolKey?.currency1, chainId) ?? undefined
  const cake = CAKE[chainId]

  const txKey =
    position.protocol === Protocol.InfinityCLAMM
      ? `infinity-${chainId}-${position.poolId}-${(position as InfinityCLPositionDetail).tokenId}`
      : `infinity-${chainId}-${position.poolId}`

  if (!currency0 || !currency1) return null

  return (
    <PositionCard
      currency0={currency0}
      currency1={currency1}
      tokenId={
        position.protocol === Protocol.InfinityCLAMM
          ? String((position as InfinityCLPositionDetail).tokenId)
          : undefined
      }
      earningsUSD={earningsUSD}
      rewards={cake ? [{ currency: cake, amount: cakeAmount }] : []}
      status={txMap[txKey]?.status}
      isLast={isLast}
    />
  )
}

function V2HarvestRow({
  position,
  txMap,
  isLast,
}: {
  position: V2LPDetail
  txMap: Record<string, { status?: HarvestTxStatus }>
  isLast?: boolean
}) {
  const { chainId } = position.pair
  const cake = CAKE[chainId]
  const txKey = `v2-${position.pair?.liquidityToken?.address}`

  if (!position.pair?.token0 || !position.pair?.token1) return null

  return (
    <PositionCard
      currency0={position.pair.token0}
      currency1={position.pair.token1}
      earningsUSD={0}
      rewards={cake ? [{ currency: cake, amount: 0 }] : []}
      status={txMap[txKey]?.status}
      isLast={isLast}
    />
  )
}

function StableHarvestRow({
  position,
  txMap,
  isLast,
}: {
  position: StableLPDetail
  txMap: Record<string, { status?: HarvestTxStatus }>
  isLast?: boolean
}) {
  const { chainId } = position.pair.liquidityToken
  const cake = CAKE[chainId]
  const lpAddress: string | undefined =
    (position as any).pair?.stableSwapAddress ?? position.pair?.liquidityToken?.address
  const txKey = `ss-${lpAddress}`

  if (!position.pair?.token0 || !position.pair?.token1) return null

  return (
    <PositionCard
      currency0={position.pair.token0}
      currency1={position.pair.token1}
      earningsUSD={0}
      rewards={cake ? [{ currency: cake, amount: 0 }] : []}
      status={txMap[txKey]?.status}
      isLast={isLast}
    />
  )
}

// --- Panel ---

export interface EvmHarvestPanelProps {
  v3HarvestPositions: V3HarvestPositionEnriched[]
  infinityHarvestPositions: InfinityHarvestPositionEnriched[]
  v2Positions: V2LPDetail[]
  stablePositions: StableLPDetail[]
  totalEarningsUSD: number
  v3StakedTokenIds: string[]
  v2Targets: V2HarvestTarget[]
  otherChainsWithRewards?: number[]
  onSwitchChain?: (chainId: number) => void
}

export function EvmHarvestPanel({
  v3HarvestPositions,
  infinityHarvestPositions,
  v2Positions,
  stablePositions,
  totalEarningsUSD,
  v3StakedTokenIds,
  v2Targets,
  otherChainsWithRewards = [],
  onSwitchChain,
}: EvmHarvestPanelProps) {
  const { t } = useTranslation()
  const { chainId } = useActiveChainId()
  const txMap = useAtomValue(harvestTxMapAtom)
  const harvesting = useAtomValue(harvestingAtom)

  const { harvestAll, retryFailed, txCount } = useEvmHarvestAll({ v3StakedTokenIds, v2Targets })

  const hasStarted = useMemo(() => Object.keys(txMap).length > 0, [txMap])
  const allSucceeded = useMemo(
    () => hasStarted && Object.values(txMap).every((tx) => tx.status === HarvestTxStatus.Success),
    [txMap, hasStarted],
  )
  const failedCount = useMemo(
    () => Object.values(txMap).filter((tx) => tx.status === HarvestTxStatus.Failed).length,
    [txMap],
  )

  const chainName = chainId ? chainNames[chainId] : ''

  // Flatten all positions into a single ordered list so we can determine isLast
  const allRows = useMemo(
    () => [
      ...infinityHarvestPositions.map((item) => ({ type: 'infinity' as const, item })),
      ...v3HarvestPositions.map((item) => ({ type: 'v3' as const, item })),
      ...v2Positions.map((pos) => ({ type: 'v2' as const, pos })),
      ...stablePositions.map((pos) => ({ type: 'stable' as const, pos })),
    ],
    [infinityHarvestPositions, v3HarvestPositions, v2Positions, stablePositions],
  )

  const noRewards = allRows.length === 0

  return (
    <LightGreyCard padding="16px" borderRadius="24px" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <FlexGap justifyContent="space-between" alignItems="center" mb="12px">
        <PreTitle color="secondary">
          {t('EVM POSITIONS')}
          {chainName ? ` (${chainName.toUpperCase()})` : ''}
        </PreTitle>
        <Text bold fontSize="16px">
          {formatFiatNumber(totalEarningsUSD)}
        </Text>
      </FlexGap>

      {noRewards ? (
        <Text color="textSubtle" textAlign="center" py="16px" fontSize="14px">
          {t('No farm rewards to harvest on this chain')}
        </Text>
      ) : (
        <>
          <VerticalList>
            {allRows.map((row, idx) => {
              const isLast = idx === allRows.length - 1
              if (row.type === 'infinity') {
                const { position } = row.item
                const key =
                  position.protocol === Protocol.InfinityCLAMM
                    ? `infinity-${position.chainId}-${position.poolId}-${
                        (position as InfinityCLPositionDetail).tokenId
                      }`
                    : `infinity-${position.chainId}-${position.poolId}`
                return <InfinityHarvestRow key={key} item={row.item} txMap={txMap} isLast={isLast} />
              }
              if (row.type === 'v3') {
                return (
                  <V3HarvestRow
                    key={`v3-${row.item.position.chainId}-${row.item.position.tokenId}`}
                    item={row.item}
                    txMap={txMap}
                    chainId={chainId ?? row.item.position.chainId}
                    isLast={isLast}
                  />
                )
              }
              if (row.type === 'v2') {
                return (
                  <V2HarvestRow
                    key={`v2-${row.pos.pair?.liquidityToken?.address}`}
                    position={row.pos}
                    txMap={txMap}
                    isLast={isLast}
                  />
                )
              }
              return (
                <StableHarvestRow
                  key={`ss-${(row.pos as any).pair?.stableSwapAddress ?? row.pos.pair?.liquidityToken?.address}`}
                  position={row.pos}
                  txMap={txMap}
                  isLast={isLast}
                />
              )
            })}
          </VerticalList>

          {/* TODO: This can be hidden if EIP-5792 is supported */}
          {!hasStarted && txCount > 1 && (
            <Box mt="8px">
              <Tips
                primaryMsg={t('You will need to confirm %count% transactions in your wallet', { count: txCount })}
              />
            </Box>
          )}

          {!hasStarted && (
            <Button
              mt="12px"
              width="100%"
              variant="primary60Outline"
              disabled={harvesting || noRewards}
              onClick={harvestAll}
            >
              {t('Harvest all')}
            </Button>
          )}

          {harvesting && !allSucceeded && (
            <Button mt="12px" width="100%" variant="primary60Outline" disabled>
              {t('Harvesting')}
            </Button>
          )}

          {allSucceeded && (
            <Button mt="12px" width="100%" variant="primary60Outline" disabled>
              {t('Harvested')}
            </Button>
          )}

          {failedCount > 0 && !harvesting && (
            <>
              <Button mt="12px" width="100%" variant="primary60Outline" onClick={retryFailed}>
                {t('Retry')}
              </Button>
              <Message variant="warning" mt="12px">
                <MessageText>
                  {failedCount === 1
                    ? t('An error occurred during the harvest, please try again')
                    : t('%count% harvests failed, please try again', { count: failedCount })}
                </MessageText>
              </Message>
            </>
          )}
        </>
      )}

      {otherChainsWithRewards.length > 0 && (
        <Message variant="primary" mt="12px">
          <MessageText>
            {t('You also have earnings on ')}{' '}
            {otherChainsWithRewards.map((cId, idx) => (
              <LinkText
                key={cId}
                as="span"
                fontSize="14px"
                bold
                color="primary60"
                style={{ cursor: 'pointer' }}
                onClick={() => onSwitchChain?.(cId)}
              >
                {chainNames[cId]?.toUpperCase()}
                {idx < otherChainsWithRewards.length - 1 ? ', ' : ''}
              </LinkText>
            ))}
            {'. '}
            {t('Switch network to harvest.')}
          </MessageText>
        </Message>
      )}
    </LightGreyCard>
  )
}
