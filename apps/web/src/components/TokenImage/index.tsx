import { UnifiedCurrency } from '@pancakeswap/sdk'
import {
  ImageProps,
  TokenImage as UIKitTokenImage,
  TokenPairImage as UIKitTokenPairImage,
  TokenPairImageProps as UIKitTokenPairImageProps,
  TokenPairLogo as UIKitTokenPairLogo,
} from '@pancakeswap/uikit'
import { ASSET_CDN } from 'config/constants/endpoints'
import { useMemo, forwardRef } from 'react'
import { getCurrencyLogoSrcs, tokenImageChainNameMapping } from 'utils/tokenImages'

interface TokenPairImageProps extends Omit<UIKitTokenPairImageProps, 'primarySrc' | 'secondarySrc'> {
  primaryToken: UnifiedCurrency
  secondaryToken: UnifiedCurrency
  withChainLogo?: boolean
}

export const getChainLogoUrlFromChainId = (chainId: number) => `${ASSET_CDN}/web/chains/${chainId}.png`

export const TokenPairImage: React.FC<React.PropsWithChildren<TokenPairImageProps>> = ({
  primaryToken,
  secondaryToken,
  withChainLogo = false,
  ...props
}) => {
  const chainLogo = withChainLogo ? getChainLogoUrlFromChainId(primaryToken.chainId) : undefined
  return (
    <UIKitTokenPairImage
      primarySrc={getCurrencyLogoSrcs(primaryToken)[0]}
      secondarySrc={getCurrencyLogoSrcs(secondaryToken)[0]}
      chainLogoSrc={chainLogo}
      {...props}
    />
  )
}

export const TokenPairLogo = forwardRef<HTMLDivElement, React.PropsWithChildren<TokenPairImageProps>>(
  ({ primaryToken, secondaryToken, withChainLogo = false, ...props }, ref) => {
    const chainLogo = useMemo(
      () => (withChainLogo ? [getChainLogoUrlFromChainId(primaryToken.chainId)] : []),
      [withChainLogo, primaryToken.chainId],
    )
    const primarySrcs = getCurrencyLogoSrcs(primaryToken)
    const secondarySrcs = getCurrencyLogoSrcs(secondaryToken)
    return (
      <UIKitTokenPairLogo
        ref={ref}
        primarySrcs={primarySrcs}
        secondarySrcs={secondarySrcs}
        chainLogoSrcs={chainLogo}
        {...props}
      />
    )
  },
)

TokenPairLogo.displayName = 'TokenPairLogo'

interface TokenImageProps extends ImageProps {
  token: UnifiedCurrency
}

export const TokenImage: React.FC<React.PropsWithChildren<TokenImageProps>> = ({ token, ...props }) => {
  return <UIKitTokenImage src={getCurrencyLogoSrcs(token)[0]} {...props} />
}

export { getCurrencyLogoSrcs, tokenImageChainNameMapping }
