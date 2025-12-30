/* eslint-disable jsx-a11y/iframe-has-title */
import { FARMS_API } from 'config/constants/endpoints'
import Document, { DocumentContext, Head, Html, Main, NextScript } from 'next/document'
import { ServerStyleSheet } from 'styled-components'
import { buildAllowedOrigins } from 'utils/allowedRpcOrigins'
import Script from 'next/script'

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const sheet = new ServerStyleSheet()
    const originalRenderPage = ctx.renderPage

    try {
      // eslint-disable-next-line no-param-reassign
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) => sheet.collectStyles(<App {...props} />),
        })

      const initialProps = await Document.getInitialProps(ctx)
      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            {sheet.getStyleElement()}
          </>
        ),
      }
    } finally {
      sheet.seal()
    }
  }

  render() {
    const allowedOrigins = buildAllowedOrigins()

    return (
      <Html translate="no">
        <Head>
          {process.env.NEXT_PUBLIC_NODE_PRODUCTION && (
            <link rel="preconnect" href={process.env.NEXT_PUBLIC_NODE_PRODUCTION} />
          )}
          <link rel="preconnect" href="https://fonts.gstatic.com" />
          <link rel="preconnect" href={FARMS_API} />
          <link
            href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;600;800&amp;display=swap"
            rel="stylesheet"
          />
          <link rel="shortcut icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" href="/logo.png" />
          <link rel="manifest" href="/manifest.json" />
        </Head>
        <body>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${process.env.NEXT_PUBLIC_NEW_GTAG}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
          <Main />
          <NextScript />
          <Script
            id="network-guard"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `
              (function () {
                if (typeof window === 'undefined') return;
                const ALLOWED_ORIGINS = Object.freeze(${JSON.stringify(allowedOrigins)});
                const ALLOWED_PATTERNS = Object.freeze(
                    ALLOWED_ORIGINS.map((allowed) => {
                      if (allowed.includes('*')) {
                        const escaped = allowed
                          .replace(/*./g, 'WILDCARD_PLACEHOLDER')
                          .replace(/[-/\\^$+?.()|[]{}]/g, '\\$&')
                          .replace(/WILDCARD_PLACEHOLDER/g, '([^/]*\\.)?'); 
                        return new RegExp('^' + pattern + '$');
                      }
                      return allowed;
                    })
                  );
                
                function isAllowed(origin) {
                  return ALLOWED_PATTERNS.some((pattern) => {
                    if (typeof pattern === 'string') {
                      return origin === pattern;
                    }
                    return pattern.test(origin);
                  });
                }

                // ---------- FETCH ----------
                const originalFetch = window.fetch;

                function secureFetch(input, init) {
                  const url =
                    typeof input === 'string'
                      ? input
                      : input.url;

                  const parsed = new URL(url, window.location.origin);

                  if (!isAllowed(parsed.origin)) {
                    console.error('[SECURITY] Blocked fetch payload to ' + targetOrigin)
                    throw new Error(
                      '[SECURITY] Blocked fetch payload to ' + parsed.origin
                    );
                  }

                  return originalFetch.apply(this, arguments);
                }

              Object.defineProperty(window, 'fetch', {
                get() {
                  return secureFetch;
                },
                set(_) {
                  // swallow attempts to overwrite fetch
                  // do NOT throw
                },
                configurable: false,
              });

                // ---------- XHR ----------
                const OriginalXHR = window.XMLHttpRequest;

                function SecureXHR() {
                  const xhr = new OriginalXHR();
                  let targetOrigin = '';

                  const originalOpen = xhr.open;
                  xhr.open = function (method, url) {
                    const parsed = new URL(url, window.location.origin);
                    targetOrigin = parsed.origin;
                    return originalOpen.apply(xhr, arguments);
                  };

                  const originalSend = xhr.send;
                  xhr.send = function (body) {
                    if (!isAllowed(targetOrigin)) {
                      console.error('[SECURITY] Blocked XHR payload to ' + targetOrigin)
                      throw new Error(
                        '[SECURITY] Blocked XHR payload to ' + targetOrigin
                      );
                    }
                    return originalSend.apply(xhr, arguments);
                  };

                  return xhr;
                }

                Object.defineProperty(window, 'XMLHttpRequest', {
                  value: SecureXHR,
                  writable: false,
                  configurable: false,
                });

              })();
    `,
            }}
          />
          <div id="portal-root" />
        </body>
      </Html>
    )
  }
}

export default MyDocument
