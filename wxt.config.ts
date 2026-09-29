import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

// WXT loads .env into process.env before evaluating the manifest.
const requireLicense = () => process.env.WXT_REQUIRE_LICENSE === 'true';

// https://wxt.dev/api/config.html
export default defineConfig({
  manifest: ({ browser }) => ({
    name: 'UK IPA Pop-up',
    description: 'Show the UK (British) IPA pronunciation of any word you highlight. Works offline.',
    // The license check talks to our own server, which sends CORS headers, so no host permissions are needed.
    permissions: ['storage'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: process.env.WXT_GECKO_ID || 'uk-ipa@afilnor.github.io',
          // The free build sends nothing anywhere. Before shipping the paid build to Firefox, declare what the
          // license check and the lost-key form send (see Mozilla's "built-in data consent" docs).
          ...(!requireLicense() && { data_collection_permissions: { required: ['none'] } }),
        },
      },
    }),
  }),
  hooks: {
    // Ship the license and data credits inside every build (GPL-3.0 and CC BY-SA require it).
    'build:publicAssets': (wxt, files) => {
      files.push(
        { absoluteSrc: resolve(wxt.config.root, 'LICENSE'), relativeDest: 'LICENSE.txt' },
        { absoluteSrc: resolve(wxt.config.root, 'THIRD_PARTY_NOTICES.md'), relativeDest: 'THIRD_PARTY_NOTICES.md' },
      );
    },
  },
  zip: {
    // Firefox reviewers need the source; also ship license notices with every build.
    excludeSources: ['.dataset-cache/**', 'license-server/**', '.github/**'],
  },
});
