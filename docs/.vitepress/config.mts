import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// https://vitepress.dev/reference/site-config
export default withMermaid({
  title: "File Processing System Docs",
  description: "Complete documentation for file processing system with LocalStack and Elasticsearch",
  
  mermaid: {
    // Mermaid config
  },
  
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
        ]
      },
      {
        text: 'AWS Lambda',
        items: [
          { text: 'Complete Guide', link: '/lamda/LAMBDA-COMPLETE-GUIDE' },
          { text: 'Deployment & CI/CD', link: '/lamda/LAMBDA-DEPLOYMENT-GUIDE' },
          { text: 'Cache Mechanism', link: '/lamda/LAMBDA-CACHE-MECHANISM' },
          { text: 'Cache Layers', link: '/lamda/LAMBDA-CACHE-LAYERS' },
          { text: 'Caching Guide', link: '/lamda/LAMBDA-CACHING-GUIDE' },
          { text: 'LocalStack Limitations', link: '/lamda/LOCALSTACK-LAMBDA-LIMITATIONS' }
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
      ],
      '/lamda/': [
        {
          text: '⚡ AWS Lambda',
          items: [
            { text: 'Complete Certification Guide', link: '/lamda/LAMBDA-COMPLETE-GUIDE' },
            { text: 'Deployment & CI/CD Guide', link: '/lamda/LAMBDA-DEPLOYMENT-GUIDE' },
            { text: 'Cache Mechanism', link: '/lamda/LAMBDA-CACHE-MECHANISM' },
            { text: 'Cache Layers Deep Dive', link: '/lamda/LAMBDA-CACHE-LAYERS' },
            { text: 'Caching Implementation', link: '/lamda/LAMBDA-CACHING-GUIDE' },
            { text: 'LocalStack Limitations', link: '/lamda/LOCALSTACK-LAMBDA-LIMITATIONS' }
          ]
        },
        {
          text: '📚 Topics',
          collapsed: false,
          items: [
            { text: '🎓 Certification Guide', link: '/lamda/LAMBDA-COMPLETE-GUIDE#certification-exam-topics' },
            { text: '🚀 Deployment & CI/CD', link: '/lamda/LAMBDA-DEPLOYMENT-GUIDE' },
            { text: '🏗️ Architecture Patterns', link: '/lamda/LAMBDA-COMPLETE-GUIDE#common-architecture-patterns' },
            { text: '🔧 Troubleshooting', link: '/lamda/LAMBDA-COMPLETE-GUIDE#troubleshooting' },
            { text: '⚖️ Pros & Cons', link: '/lamda/LAMBDA-COMPLETE-GUIDE#pros--cons' },
            { text: '⚠️ Limitations', link: '/lamda/LAMBDA-COMPLETE-GUIDE#limitations--pain-points' }
          ]
        },
        {
          text: '💾 Caching',
          collapsed: false,
          items: [
            { text: '🔄 Cache Mechanism', link: '/lamda/LAMBDA-CACHE-MECHANISM' },
            { text: '📊 4 Cache Layers', link: '/lamda/LAMBDA-CACHE-LAYERS' },
            { text: '📖 Implementation Guide', link: '/lamda/LAMBDA-CACHING-GUIDE' },
            { text: '⚠️ LocalStack Issues', link: '/lamda/LOCALSTACK-LAMBDA-LIMITATIONS' }
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