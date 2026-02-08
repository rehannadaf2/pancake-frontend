import { useStablecoinPrice } from 'hooks/useStablecoinPrice'
import { useMemo } from 'react'
import { PoolInfo } from 'state/farmsV4/state/type'
import styled from 'styled-components'

const Bar = styled.div<{ percentage: number }>`
  position: relative;
  width: 100%;
  height: 5px;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.colors.v2Primary50};

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: ${({ percentage }) => percentage}%;
    height: 100%;
    background-color: ${({ theme }) => theme.colors.textSubtle};
    border-radius: 8px;
  }
`

interface PoolTokensBarProps {
  poolInfo?: PoolInfo | null
}

export const PoolTokensBar: React.FC<PoolTokensBarProps> = ({ poolInfo }) => {
  const { token0, token1 } = poolInfo ?? {}

  const price0 = useStablecoinPrice(token0)
  const price1 = useStablecoinPrice(token1)

  const token0UsdPrice = price0 ? Number(price0.toSignificant()) : 0
  const token1UsdPrice = price1 ? Number(price1.toSignificant()) : 0

  const token0UsdValue = useMemo(() => {
    if (!token0UsdPrice || !poolInfo) return 0
    return token0UsdPrice * Number(poolInfo.tvlToken0)
  }, [token0UsdPrice, poolInfo])

  const token1UsdValue = useMemo(() => {
    if (!token1UsdPrice || !poolInfo) return 0
    return token1UsdPrice * Number(poolInfo.tvlToken1)
  }, [token1UsdPrice, poolInfo])

  if (!poolInfo || token0UsdValue === 0 || token1UsdValue === 0) {
    return null
  }

  return (
    <>
      <Bar percentage={(token0UsdValue / (token0UsdValue + token1UsdValue)) * 100} />
    </>
  )
}
