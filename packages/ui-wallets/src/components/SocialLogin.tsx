import { useTranslation } from '@pancakeswap/localization'
import {
  FlexGap,
  Button,
  CloseIcon,
  Column,
  Heading,
  IconButton,
  RowBetween,
  SocialLoginDiscordIcon,
  SocialLoginTelegramIcon,
  SocialLoginXIcon,
  Text,
  useMatchBreakpoints,
  ArrowBackIcon,
  Message,
  MessageText,
} from '@pancakeswap/uikit'
import styled, { useTheme } from 'styled-components'
import { chainFullNames, ChainId } from '@pancakeswap/chains'
import { ASSET_CDN } from '../config/url'

interface SocialLoginProps {
  chainId?: ChainId
  onGoogleLogin?: () => void
  onXLogin?: () => void
  onTelegramLogin?: () => void
  onDiscordLogin?: () => void
  onDismiss?: () => void
}

const SocialLoginButton = styled(Button)<{ disabled?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 12px;
  border-radius: 16px;
  background-color: ${({ theme }) => theme.colors.backgroundAlt};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  box-shadow: 0px 2px 0px 0px ${({ theme }) => theme.colors.cardBorder};
  gap: 4px;
  height: 56px;

  ${({ disabled, theme }) =>
    disabled &&
    `
      opacity: 0.5;
      cursor: not-allowed;
      background-color: ${theme.colors.backgroundDisabled};
      box-shadow: none;
    `}
`

const SocialLoginButtonVertical = styled(SocialLoginButton)`
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 12px;
  min-height: 100px;
`

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  width: 32px;
  margin-bottom: 4px;
  svg {
    width: 32px;
    height: 32px;
  }
`

const NoticeCard = styled.div`
  background-color: ${({ theme }) => theme.colors.cardSecondary};
  border: 1px solid ${({ theme }) => theme.colors.cardBorder};
  border-radius: 16px;
  padding: 12px;
  margin-bottom: 16px;

  display: flex;
  flex-direction: column;
  align-items: center;

  width: 100%;
`

const SOCIAL_LOGIN_ALLOWED_CHAINS: ChainId[] = [
  ChainId.BSC,
  ChainId.ETHEREUM,
  ChainId.BASE,
  ChainId.ARBITRUM_ONE,
  ChainId.LINEA,
  ChainId.OPBNB,
  ChainId.MONAD_MAINNET,
]

const allowedChainNames = SOCIAL_LOGIN_ALLOWED_CHAINS.map((id) => chainFullNames[id]).join(', ')

const SocialLogin: React.FC<SocialLoginProps> = ({
  chainId,
  onGoogleLogin,
  onXLogin,
  onTelegramLogin,
  onDiscordLogin,
  onDismiss,
}) => {
  const { t } = useTranslation()
  const { isMobile } = useMatchBreakpoints()
  const { isDark } = useTheme()

  const isChainAllowed = chainId && SOCIAL_LOGIN_ALLOWED_CHAINS.includes(chainId)

  return (
    <>
      {isMobile ? (
        <RowBetween>
          <Heading color="color" as="h4">
            {t('Connect to PancakeSwap')}
          </Heading>
          <IconButton variant="text" onClick={onDismiss} mr="-12px">
            <CloseIcon />
          </IconButton>
        </RowBetween>
      ) : null}
      <Column gap="12px">
        <SocialLoginButton onClick={onGoogleLogin} disabled={!isChainAllowed}>
          <img
            src={`${ASSET_CDN}/web/wallets/social-login/google.jpg`}
            width="32"
            height="32"
            alt="Google"
            style={{ borderRadius: '8px' }}
          />
          <Text>{t('Continue with Google')}</Text>
        </SocialLoginButton>

        <FlexGap gap="8px" width="100%">
          <SocialLoginButtonVertical onClick={onXLogin} disabled={!isChainAllowed}>
            <IconWrapper>
              <SocialLoginXIcon />
            </IconWrapper>
            <Text style={{ whiteSpace: 'nowrap' }}>{t('X Login')}</Text>
          </SocialLoginButtonVertical>

          <SocialLoginButtonVertical onClick={onTelegramLogin} disabled={!isChainAllowed}>
            <IconWrapper>
              <SocialLoginTelegramIcon />
            </IconWrapper>
            <Text>{t('Telegram')}</Text>
          </SocialLoginButtonVertical>

          <SocialLoginButtonVertical onClick={onDiscordLogin} disabled={!isChainAllowed}>
            <IconWrapper>
              <SocialLoginDiscordIcon />
            </IconWrapper>
            <Text>{t('Discord')}</Text>
          </SocialLoginButtonVertical>
        </FlexGap>
        <Message variant={isDark ? 'primary' : 'primary60'}>
          <MessageText>
            {t('Social login works only on %chains%. Sending funds on other networks may cause permanent loss.', {
              chains: allowedChainNames,
            })}
          </MessageText>
        </Message>
      </Column>
      {isMobile ? (
        <>
          <Divider>
            <Text color="textSubtle" style={{ transform: 'translateY(-12px)' }}>
              {t('or')}
            </Text>
          </Divider>
          <NoticeCard onClick={onDismiss}>
            <FlexGap gap="4px">
              <ArrowBackIcon />
              <Text>{t('Continue with Web3 Wallet')}</Text>
            </FlexGap>
          </NoticeCard>
        </>
      ) : null}
    </>
  )
}

const Divider = styled.div`
  height: 1px;
  background-color: ${({ theme }) => theme.colors.cardBorder};
  width: 100%;
  margin: 16px 0;
  text-align: center;
`

export default SocialLogin
