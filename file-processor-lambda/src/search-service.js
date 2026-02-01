const { Client } = require('@elastic/elasticsearch');
const { generateEmbedding } = require('./markdown-chunker');

/**
 * ============================================
 * ADVANCED SEARCH SERVICE
 * ============================================
 * 
 * Support:
 * 1. Text-based search (BM25)
 * 2. Semantic search (Vector similarity)
 * 3. Hybrid search (Combined)
 * 4. Scroll-to-position metadata
 */

class SearchService {
  constructor(config = {}) {
    this.esClient = new Client({
      node: config.node || process.env.ELASTICSEARCH_NODE || 'http://localhost:4566',
      auth: {
        username: config.username || process.env.ELASTICSEARCH_USERNAME || 'admin',
        password: config.password || process.env.ELASTICSEARCH_PASSWORD || 'admin',
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    this.index = config.index || process.env.ELASTICSEARCH_INDEX || 'file-chunks';
  }

  /**
   * TEXT SEARCH - Truyền thống keyword-based
   * Tốt cho: exact matches, specific terms, code snippets
   */
  async textSearch(query, options = {}) {
    const {
      fileId = null,
      page = 1,
      size = 10,
      minScore = 0.5,
      includePosition = true
    } = options;

    const must = [
      {
        multi_match: {
          query: query,
          fields: [
            'content^3',           // Content cao nhất
            'heading.text^2',      // Heading quan trọng
            'searchTerms^1.5',     // Search terms
            'metadata.fileName',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      }
    ];

    if (fileId) {
      must.push({ term: { fileId } });
    }

    const searchBody = {
      query: {
        bool: {
          must,
          should: [
            { term: { 'metadata.hasCodeBlock': { value: true, boost: 1.2 } } },
            { exists: { field: 'heading', boost: 1.1 } }
          ]
        }
      },
      min_score: minScore,
      from: (page - 1) * size,
      size,
      highlight: {
        fields: {
          content: {
            fragment_size: 150,
            number_of_fragments: 3,
            pre_tags: ['<mark>'],
            post_tags: ['</mark>']
          }
        }
      },
      sort: ['_score']
    };

    const response = await this.esClient.search({
      index: this.index,
      body: searchBody
    });

    return this.formatSearchResults(response, includePosition);
  }

  /**
   * SEMANTIC SEARCH - AI-powered vector similarity
   * Tốt cho: conceptual search, meaning-based, paraphrases
   */
  async semanticSearch(query, options = {}) {
    const {
      fileId = null,
      page = 1,
      size = 10,
      minScore = 0.7,
      includePosition = true
    } = options;

    // Generate query embedding
    console.log('Generating query embedding...');
    const queryEmbedding = await generateEmbedding(query);

    if (!queryEmbedding) {
      throw new Error('Failed to generate query embedding');
    }

    const must = [];
    if (fileId) {
      must.push({ term: { fileId } });
    }

    const searchBody = {
      query: {
        bool: {
          must,
          should: [
            {
              script_score: {
                query: { match_all: {} },
                script: {
                  source: "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                  params: {
                    query_vector: queryEmbedding
                  }
                }
              }
            }
          ]
        }
      },
      min_score: minScore,
      from: (page - 1) * size,
      size,
      _source: {
        excludes: ['embedding'] // Don't return embedding in results
      }
    };

    const response = await this.esClient.search({
      index: this.index,
      body: searchBody
    });

    return this.formatSearchResults(response, includePosition);
  }

  /**
   * HYBRID SEARCH - Combines text and semantic search
   * Best of both worlds: keyword precision + semantic understanding
   * Uses Reciprocal Rank Fusion (RRF) algorithm
   */
  async hybridSearch(query, options = {}) {
    const {
      fileId = null,
      page = 1,
      size = 10,
      textWeight = 0.5,
      semanticWeight = 0.5,
      includePosition = true
    } = options;

    console.log(`Hybrid search: text(${textWeight}) + semantic(${semanticWeight})`);

    // Execute both searches in parallel
    const [textResults, semanticResults] = await Promise.all([
      this.textSearch(query, { fileId, page: 1, size: size * 2 }),
      this.semanticSearch(query, { fileId, page: 1, size: size * 2 })
    ]);

    // Reciprocal Rank Fusion (RRF)
    const k = 60; // RRF constant
    const scoreMap = new Map();

    // Add text search scores
    textResults.results.forEach((result, index) => {
      const rrf = textWeight / (k + index + 1);
      scoreMap.set(result.id, {
        ...result,
        score: rrf,
        textRank: index + 1
      });
    });

    // Add semantic search scores
    semanticResults.results.forEach((result, index) => {
      const rrf = semanticWeight / (k + index + 1);
      const existing = scoreMap.get(result.id);
      
      if (existing) {
        existing.score += rrf;
        existing.semanticRank = index + 1;
      } else {
        scoreMap.set(result.id, {
          ...result,
          score: rrf,
          semanticRank: index + 1
        });
      }
    });

    // Sort by combined score
    const combined = Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice((page - 1) * size, page * size);

    return {
      total: scoreMap.size,
      took: textResults.took + semanticResults.took,
      results: combined,
      searchType: 'hybrid',
      weights: { textWeight, semanticWeight }
    };
  }

  /**
   * SCROLL TO POSITION - Search với scroll metadata
   * Returns position info để frontend có thể scroll đến đúng vị trí
   */
  async searchWithScroll(query, options = {}) {
    const searchType = options.searchType || 'hybrid';
    
    let results;
    switch (searchType) {
      case 'text':
        results = await this.textSearch(query, { ...options, includePosition: true });
        break;
      case 'semantic':
        results = await this.semanticSearch(query, { ...options, includePosition: true });
        break;
      case 'hybrid':
      default:
        results = await this.hybridSearch(query, { ...options, includePosition: true });
    }

    // Enhance with scroll instructions
    results.results = results.results.map(result => ({
      ...result,
      scrollTo: this.generateScrollInstructions(result)
    }));

    return results;
  }

  /**
   * Generate scroll instructions for frontend
   */
  generateScrollInstructions(result) {
    if (!result.position) return null;

    return {
      // For line-based scrolling
      line: result.position.startLine,
      
      // For percentage-based scrolling
      percent: result.position.percentPosition,
      
      // For byte-based scrolling
      byte: result.position.startByte,
      
      // For anchor-based scrolling (nếu có heading)
      anchor: result.heading ? `#${result.heading.id}` : null,
      
      // Range để highlight
      range: {
        start: result.position.startLine,
        end: result.position.endLine
      }
    };
  }

  /**
   * Format search results
   */
  formatSearchResults(response, includePosition = true) {
    const hits = response.hits;

    return {
      total: hits.total.value,
      took: response.took,
      maxScore: hits.max_score,
      results: hits.hits.map(hit => {
        const result = {
          id: hit._id,
          score: hit._score,
          fileId: hit._source.fileId,
          chunkIndex: hit._source.chunkIndex,
          content: hit._source.content,
          metadata: hit._source.metadata
        };

        if (includePosition && hit._source.position) {
          result.position = hit._source.position;
        }

        if (hit._source.heading) {
          result.heading = hit._source.heading;
        }

        if (hit._source.section) {
          result.section = hit._source.section;
        }

        if (hit.highlight) {
          result.highlights = hit.highlight.content;
        }

        return result;
      })
    };
  }

  /**
   * Get file structure for navigation
   */
  async getFileStructure(fileId) {
    const response = await this.esClient.search({
      index: this.index,
      body: {
        query: { term: { fileId } },
        size: 1000,
        sort: [{ chunkIndex: 'asc' }],
        _source: ['chunkIndex', 'heading', 'position', 'metadata']
      }
    });

    const chunks = response.hits.hits.map(hit => hit._source);

    // Extract table of contents from headings
    const toc = chunks
      .filter(chunk => chunk.heading)
      .map(chunk => ({
        text: chunk.heading.text,
        level: chunk.heading.level,
        id: chunk.heading.id,
        chunkIndex: chunk.chunkIndex,
        position: chunk.position
      }));

    return {
      fileId,
      totalChunks: chunks.length,
      tableOfContents: toc,
      metadata: chunks[0]?.metadata || {}
    };
  }

  /**
   * Get specific chunk by position
   */
  async getChunkByPosition(fileId, position) {
    const { line, percent, byte } = position;

    const must = [{ term: { fileId } }];

    // Build query based on available position info
    if (line !== undefined) {
      must.push({
        range: {
          'position.startLine': { lte: line }
        }
      });
      must.push({
        range: {
          'position.endLine': { gte: line }
        }
      });
    } else if (percent !== undefined) {
      const margin = 5; // 5% margin
      must.push({
        range: {
          'position.percentPosition': {
            gte: percent - margin,
            lte: percent + margin
          }
        }
      });
    } else if (byte !== undefined) {
      must.push({
        range: {
          'position.startByte': { lte: byte }
        }
      });
      must.push({
        range: {
          'position.endByte': { gte: byte }
        }
      });
    }

    const response = await this.esClient.search({
      index: this.index,
      body: {
        query: { bool: { must } },
        size: 1
      }
    });

    if (response.hits.hits.length === 0) {
      return null;
    }

    return response.hits.hits[0]._source;
  }
}

module.exports = SearchService;
