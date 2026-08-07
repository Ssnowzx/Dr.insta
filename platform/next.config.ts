import type { NextConfig } from 'next'

/**
 * `standalone` bundles the server with only the dependencies it actually
 * imports. The final image does not carry the whole of `node_modules` — on a
 * VPS that is the difference between a ~150 MB image and a ~1 GB one.
 */
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,

  /* `platform/` lives inside the Myfavorite repo, which has its own
     package-lock.json. Without pinning the root here, Turbopack finds both
     lockfiles and picks one — and the pick changes depending on where the build
     was launched from. Pinning makes the build identical locally and on the VPS. */
  turbopack: {
    root: import.meta.dirname
  },

  /* Client documents carry revenue, conversion and audience data. The rule
     applies to the whole domain rather than page by page: a new screen is born
     protected without anyone having to remember. */
  async headers () {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'x-robots-tag', value: 'noindex, nofollow, noarchive' },
          { key: 'referrer-policy', value: 'no-referrer' },
          { key: 'x-content-type-options', value: 'nosniff' },
          { key: 'x-frame-options', value: 'DENY' },
          { key: 'permissions-policy', value: 'camera=(), microphone=(), geolocation=()' },

          /* Sent by the app rather than by the proxy on purpose. The host's
             config is written by Virtualmin, which rewrites it on its own
             schedule — a header added there is a header that can disappear
             without anyone noticing. Here it ships with the build.

             Safe in development: the spec forbids honouring HSTS received over
             plain HTTP, so browsers drop it on `localhost`. */
          { key: 'strict-transport-security', value: 'max-age=31536000; includeSubDomains' }
        ]
      }
    ]
  }
}

export default config
