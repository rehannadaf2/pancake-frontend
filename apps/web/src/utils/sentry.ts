import { captureException } from '@sentry/nextjs'
import { UserRejectedRequestError } from 'viem'

const assignError = (maybeError: any) => {
  if (typeof maybeError === 'string') {
    return new Error(maybeError)
  }
  if (typeof maybeError === 'object') {
    const error = new Error(maybeError?.message ?? String(maybeError))
    if (maybeError?.stack) {
      error.stack = maybeError.stack
    }
    if (maybeError?.code) {
      error.name = maybeError.code
    }
    return error
  }
  return maybeError
}

const possibleRejectMessage = ['cancel', 'denied', 'Transaction was rejected', 'user has reject']

// provider user rejected error code
export const isUserRejected = (err) => {
  if (err instanceof UserRejectedRequestError) {
    return true
  }
  if (err && typeof err === 'object') {
    if (typeof err?.details === 'string' || typeof err?.cause === 'string') {
      const details = typeof err.details === 'string' ? err.details.toLowerCase() : ''
      const cause = typeof err.cause === 'string' ? err.cause.toLowerCase() : ''
      // fallback for some wallets that don't follow EIP 1193, trust, safe
      if (
        possibleRejectMessage.some((msg) => {
          const lowerMsg = msg.toLowerCase()
          return details.includes(lowerMsg) || cause.includes(lowerMsg)
        })
      ) {
        return true
      }
    }

    // fallback for raw rpc error code
    if (
      ('code' in err && (err.code === 4001 || err.code === 'ACTION_REJECTED')) ||
      ('cause' in err && err.cause && typeof err.cause === 'object' && 'code' in err.cause && err.cause.code === 4001)
    ) {
      return true
    }

    if ('cause' in err) {
      return isUserRejected(err.cause)
    }
  }
  return false
}

const ENABLED_LOG = false

export const logError = (error: Error | unknown) => {
  if (ENABLED_LOG) {
    if (error instanceof Error) {
      captureException(error)
    } else {
      captureException(assignError(error))
    }
  }
  console.error(error)
}
