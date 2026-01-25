import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "File Processing System Docs",
  description: "Complete documentation for file processing system with LocalStack and Elasticsearch",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Quick Start', link: '/QUICKSTART' },
      { text: 'Workflow', link: '/WORKFLOW' },
      { text: 'Architecture', link: '/ARCHITECTURE' },
      { 
        text: 'Guides', 
        items: [
          { text: 'Kibana Guide', link: '/KIBANA-GUIDE' },
          { text: 'AWS Cloud Architecture', link: '/AWS-CLOUD-ARCHITECTURE' },
          { text: 'Chunking Strategies', link: '/CHUNKING-STRATEGIES' }
        ]
      },
      {
        text: 'Elasticsearch',
        items: [
          { text: 'Overview', link: '/elasticsearch/README' },
          { text: 'Concepts', link: '/elasticsearch/CONCEPTS' },
          { text: 'Architecture', link: '/elasticsearch/ARCHITECTURE' },
          { text: 'Enterprise Use Cases', link: '/elasticsearch/ENTERPRISE-USE-CASES' },
          { text: 'Optimization', link: '/elasticsearch/OPTIMIZATION' }
        ]
      }
    ],

    sidebar: {
      '/': [
        {
          text: '🚀 Getting Started',
          items: [
            { text: 'Documentation Index', link: '/README' },
            { text: 'Quick Start', link: '/QUICKSTART' },
            { text: 'Complete Workflow', link: '/WORKFLOW' },
            { text: 'System Architecture', link: '/ARCHITECTURE' }
          ]
        },
        {
          text: '📚 Guides',
          items: [
            { text: 'Kibana User Guide', link: '/KIBANA-GUIDE' },
            { text: 'AWS Cloud Architecture', link: '/AWS-CLOUD-ARCHITECTURE' },
            { text: 'Chunking Strategies', link: '/CHUNKING-STRATEGIES' }
          ]
        }
      ],
      '/elasticsearch/': [
        {
          text: '📖 Elasticsearch Learning',
          items: [
            { text: 'Overview & Learning Path', link: '/elasticsearch/README' },
            { text: 'Core Concepts', link: '/elasticsearch/CONCEPTS' },
            { text: 'Cluster Architecture', link: '/elasticsearch/ARCHITECTURE' },
            { text: 'Enterprise Use Cases', link: '/elasticsearch/ENTERPRISE-USE-CASES' },
            { text: 'Optimization Strategies', link: '/elasticsearch/OPTIMIZATION' }
          ]
        },
        {
          text: '🔙 Back to Main Docs',
          items: [
            { text: '← Documentation Index', link: '/README' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'File Processing System Documentation - 2026'
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3]
    }
  }
})
