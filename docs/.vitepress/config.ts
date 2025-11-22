import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Sequelize Version',
  description: 'Automatically version your Sequelize models with TypeScript support',
  base: '/sequelize-version/',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'Examples', link: '/examples/' },
      {
        text: 'Links',
        items: [
          { text: 'GitHub', link: 'https://github.com/ivmarcos/sequelize-version' },
          { text: 'npm', link: 'https://www.npmjs.com/package/sequelize-version' },
          { text: 'Changelog', link: 'https://github.com/ivmarcos/sequelize-version/blob/master/CHANGELOG.md' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Why Versioning?', link: '/guide/why-versioning' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Basic Usage', link: '/guide/basic-usage' },
            { text: 'Custom Attributes', link: '/guide/custom-attributes' },
            { text: 'Diff Tool', link: '/guide/diff-tool' },
            { text: 'Transactions', link: '/guide/transactions' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Compatibility', link: '/guide/compatibility' },
            { text: 'TypeScript', link: '/guide/typescript' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Version', link: '/api/' },
            { text: 'Options', link: '/api/options' },
            { text: 'Types', link: '/api/types' },
            { text: 'Utilities', link: '/api/utilities' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: 'Audit Log', link: '/examples/audit-log' },
            { text: 'User Tracking', link: '/examples/user-tracking' },
            { text: 'Undo/Redo', link: '/examples/undo-redo' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ivmarcos/sequelize-version' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Marcos Vinicius',
    },

    search: {
      provider: 'local',
    },
  },
});
