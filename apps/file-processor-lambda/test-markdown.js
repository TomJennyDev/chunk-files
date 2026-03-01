// Test script for markdown processing and search
const SearchService = require('./src/search-service');
const { createMarkdownChunks } = require('./src/markdown-chunker');
const fs = require('fs').promises;

async function testMarkdownProcessing() {
  console.log('='.repeat(50));
  console.log('TESTING MARKDOWN PROCESSING & SEARCH');
  console.log('='.repeat(50));

  // Sample markdown content
  const sampleMarkdown = `# Elasticsearch Guide

## Introduction

Elasticsearch is a distributed, RESTful search and analytics engine capable of addressing a growing number of use cases.

### Why Use Elasticsearch?

- Fast full-text search
- Scalable architecture
- Real-time analytics

## Installation

### Prerequisites

Before installing Elasticsearch, ensure you have:

1. Java 11 or higher
2. At least 4GB RAM
3. Sufficient disk space

### Download and Install

\`\`\`bash
wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.0.0.tar.gz
tar -xzf elasticsearch-8.0.0.tar.gz
cd elasticsearch-8.0.0
./bin/elasticsearch
\`\`\`

## Configuration

Edit the \`elasticsearch.yml\` file:

\`\`\`yaml
cluster.name: my-cluster
node.name: node-1
network.host: 0.0.0.0
\`\`\`

### Memory Settings

For production, configure heap size:

\`\`\`bash
export ES_JAVA_OPTS="-Xms4g -Xmx4g"
\`\`\`

## Basic Operations

### Create an Index

\`\`\`bash
curl -X PUT "localhost:9200/my-index?pretty"
\`\`\`

### Index a Document

\`\`\`json
{
  "title": "First Document",
  "content": "This is my first document"
}
\`\`\`

### Search Documents

Use the **match** query for full-text search:

\`\`\`bash
curl -X GET "localhost:9200/my-index/_search?pretty" -H 'Content-Type: application/json' -d'
{
  "query": {
    "match": {
      "content": "first document"
    }
  }
}
'
\`\`\`

## Advanced Topics

### Sharding Strategy

Elasticsearch distributes data across multiple shards for scalability.

**Best Practices:**
- Use 1 shard per 20-30GB of data
- Avoid too many small shards
- Monitor shard allocation

### Replication

Configure replicas for high availability:

\`\`\`json
{
  "settings": {
    "number_of_replicas": 2
  }
}
\`\`\`

## Performance Tuning

### Query Optimization

1. Use **filter context** for exact matches
2. Avoid wildcard queries at start of terms
3. Use **search_after** for deep pagination

### Indexing Performance

- Increase refresh interval
- Use bulk API
- Disable replicas during initial load

## Conclusion

Elasticsearch provides powerful search capabilities with excellent scalability. Follow best practices for optimal performance.

For more information, visit [elastic.co](https://www.elastic.co).
`;

  try {
    // Test 1: Create chunks
    console.log('\n1. CREATING MARKDOWN CHUNKS');
    console.log('-'.repeat(50));
    
    const result = await createMarkdownChunks(sampleMarkdown, {
      chunkSize: 500,
      chunkOverlap: 100,
      fileId: 'test-file-123',
      fileName: 'elasticsearch-guide.md',
      generateEmbeddings: true
    });

    console.log(`✓ Total chunks: ${result.chunks.length}`);
    console.log(`✓ Headings found: ${result.structure.headings.length}`);
    console.log(`✓ Sections: ${result.structure.sections.length}`);
    console.log(`✓ Code blocks: ${result.structure.codeBlocks.length}`);
    console.log('\nStats:', JSON.stringify(result.stats, null, 2));

    // Test 2: Display chunk samples
    console.log('\n2. CHUNK SAMPLES');
    console.log('-'.repeat(50));
    
    result.chunks.slice(0, 3).forEach((chunk, i) => {
      console.log(`\nChunk ${i}:`);
      console.log(`  Lines: ${chunk.position.startLine}-${chunk.position.endLine}`);
      console.log(`  Position: ${chunk.position.percentPosition}%`);
      console.log(`  Heading: ${chunk.heading?.text || 'None'} (Level ${chunk.heading?.level || 'N/A'})`);
      console.log(`  Has embedding: ${chunk.embedding ? 'Yes' : 'No'}`);
      console.log(`  Search terms: ${chunk.searchTerms.slice(0, 5).join(', ')}`);
      console.log(`  Content preview: ${chunk.content.substring(0, 100)}...`);
    });

    // Test 3: Search functionality
    console.log('\n3. TESTING SEARCH');
    console.log('-'.repeat(50));

    const searchService = new SearchService({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:4566',
      index: 'file-chunks-test'
    });

    // Text search
    console.log('\n3a. TEXT SEARCH: "sharding"');
    try {
      const textResults = await searchService.textSearch('sharding', {
        size: 3,
        minScore: 0.1
      });
      console.log(`  Results: ${textResults.total}`);
      console.log(`  Took: ${textResults.took}ms`);
      textResults.results.forEach((r, i) => {
        console.log(`  ${i + 1}. Score: ${r.score.toFixed(2)} | Line ${r.position?.startLine} | ${r.heading?.text || 'No heading'}`);
      });
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }

    // Semantic search
    console.log('\n3b. SEMANTIC SEARCH: "how to scale database"');
    try {
      const semanticResults = await searchService.semanticSearch('how to scale database', {
        size: 3,
        minScore: 0.1
      });
      console.log(`  Results: ${semanticResults.total}`);
      console.log(`  Took: ${semanticResults.took}ms`);
      semanticResults.results.forEach((r, i) => {
        console.log(`  ${i + 1}. Score: ${r.score.toFixed(2)} | Line ${r.position?.startLine} | ${r.heading?.text || 'No heading'}`);
      });
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }

    // Hybrid search
    console.log('\n3c. HYBRID SEARCH: "elasticsearch performance"');
    try {
      const hybridResults = await searchService.hybridSearch('elasticsearch performance', {
        size: 3,
        textWeight: 0.5,
        semanticWeight: 0.5
      });
      console.log(`  Results: ${hybridResults.total}`);
      console.log(`  Took: ${hybridResults.took}ms`);
      hybridResults.results.forEach((r, i) => {
        console.log(`  ${i + 1}. Score: ${r.score.toFixed(2)} | Text rank: ${r.textRank || 'N/A'} | Semantic rank: ${r.semanticRank || 'N/A'}`);
      });
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }

    // Test 4: Scroll-to-position
    console.log('\n4. SCROLL-TO-POSITION');
    console.log('-'.repeat(50));
    
    const sampleChunk = result.chunks[0];
    const scrollInfo = {
      line: sampleChunk.position.startLine,
      percent: sampleChunk.position.percentPosition,
      byte: sampleChunk.position.startByte,
      anchor: sampleChunk.heading?.id
    };
    
    console.log('  Scroll instructions:');
    console.log(`    Line: ${scrollInfo.line}`);
    console.log(`    Percent: ${scrollInfo.percent}%`);
    console.log(`    Byte: ${scrollInfo.byte}`);
    console.log(`    Anchor: ${scrollInfo.anchor || 'N/A'}`);
    console.log('\n  Frontend code:');
    console.log(`    editor.scrollToLine(${scrollInfo.line});`);
    console.log(`    window.scrollTo(0, document.height * ${scrollInfo.percent / 100});`);
    if (scrollInfo.anchor) {
      console.log(`    window.location.hash = '${scrollInfo.anchor}';`);
    }

    // Test 5: Table of contents
    console.log('\n5. TABLE OF CONTENTS');
    console.log('-'.repeat(50));
    
    const toc = result.structure.headings.map(h => ({
      text: h.text,
      level: h.level,
      id: h.id,
      line: h.line
    }));

    toc.forEach(item => {
      const indent = '  '.repeat(item.level - 1);
      console.log(`${indent}${item.text} (Line ${item.line}) #${item.id}`);
    });

    // Save test output
    await fs.writeFile(
      'test-output.json',
      JSON.stringify({
        chunks: result.chunks,
        structure: result.structure,
        stats: result.stats
      }, null, 2)
    );
    console.log('\n✓ Test output saved to test-output.json');

    console.log('\n' + '='.repeat(50));
    console.log('ALL TESTS COMPLETED');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error);
    console.error(error.stack);
  }
}

// Run tests
if (require.main === module) {
  testMarkdownProcessing()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testMarkdownProcessing };
