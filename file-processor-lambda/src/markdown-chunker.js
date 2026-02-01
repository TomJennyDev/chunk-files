const { RecursiveCharacterTextSplitter, MarkdownTextSplitter } = require('@langchain/textsplitters');
const { pipeline } = require('@xenova/transformers');
const marked = require('marked');

/**
 * ============================================
 * INTELLIGENT MARKDOWN CHUNKER
 * ============================================
 * 
 * Features:
 * 1. Semantic chunking với preservation của structure
 * 2. Generate embeddings cho vector search
 * 3. Preserve metadata để scroll-to-position
 * 4. Support cả text search và AI search
 */

// Cache embedding model để tránh load nhiều lần
let embeddingModel = null;

/**
 * Initialize embedding model (singleton)
 */
async function initEmbeddingModel() {
  if (!embeddingModel) {
    console.log('Loading embedding model...');
    // Sử dụng lightweight model phù hợp với Lambda
    embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded');
  }
  return embeddingModel;
}

/**
 * Parse markdown và extract metadata
 */
function parseMarkdownStructure(content) {
  const tokens = marked.lexer(content);
  const structure = {
    headings: [],
    sections: [],
    links: [],
    codeBlocks: []
  };

  let currentHeading = null;
  let currentSection = { startLine: 1, content: '', heading: null };
  let lineNumber = 1;

  tokens.forEach(token => {
    const tokenText = token.raw || '';
    const tokenLines = tokenText.split('\n').length - 1;

    switch (token.type) {
      case 'heading':
        currentHeading = {
          level: token.depth,
          text: token.text,
          line: lineNumber,
          id: generateHeadingId(token.text)
        };
        structure.headings.push(currentHeading);

        // Start new section
        if (currentSection.content) {
          structure.sections.push(currentSection);
        }
        currentSection = {
          startLine: lineNumber,
          content: tokenText,
          heading: currentHeading,
          endLine: null
        };
        break;

      case 'link':
        structure.links.push({
          href: token.href,
          text: token.text,
          line: lineNumber
        });
        currentSection.content += tokenText;
        break;

      case 'code':
        structure.codeBlocks.push({
          lang: token.lang || 'text',
          code: token.text,
          line: lineNumber,
          lines: token.text.split('\n').length
        });
        currentSection.content += tokenText;
        break;

      default:
        currentSection.content += tokenText;
    }

    lineNumber += tokenLines;
    currentSection.endLine = lineNumber;
  });

  // Add last section
  if (currentSection.content) {
    structure.sections.push(currentSection);
  }

  return structure;
}

/**
 * Generate heading ID for scroll-to-position
 */
function generateHeadingId(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Create intelligent chunks với semantic splitting
 */
async function createMarkdownChunks(content, options = {}) {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    fileId,
    fileName,
    generateEmbeddings = true
  } = options;

  console.log(`Creating markdown chunks for ${fileName}...`);

  // Parse markdown structure
  const structure = parseMarkdownStructure(content);
  console.log(`Parsed structure: ${structure.headings.length} headings, ${structure.sections.length} sections`);

  // Use LangChain's MarkdownTextSplitter for semantic chunking
  const splitter = MarkdownTextSplitter.fromLanguage('markdown', {
    chunkSize,
    chunkOverlap
  });

  const documents = await splitter.createDocuments([content]);
  console.log(`Created ${documents.length} chunks`);

  // Enrich chunks with metadata and embeddings
  const enrichedChunks = await Promise.all(
    documents.map(async (doc, index) => {
      const chunkText = doc.pageContent;
      const startLine = findChunkStartLine(chunkText, content);
      const endLine = startLine + chunkText.split('\n').length;

      // Find relevant heading for this chunk
      const relevantHeading = findRelevantHeading(startLine, structure.headings);

      // Calculate position percentage for scroll
      const positionPercent = (startLine / content.split('\n').length) * 100;

      // Generate embedding if enabled
      let embedding = null;
      if (generateEmbeddings) {
        try {
          embedding = await generateEmbedding(chunkText);
        } catch (error) {
          console.error(`Failed to generate embedding for chunk ${index}:`, error.message);
        }
      }

      return {
        fileId,
        chunkIndex: index,
        content: chunkText,
        
        // Position metadata for scroll-to
        position: {
          startLine,
          endLine,
          startByte: calculateBytePosition(content, startLine),
          endByte: calculateBytePosition(content, endLine),
          percentPosition: Math.round(positionPercent * 100) / 100
        },

        // Heading context for better search
        heading: relevantHeading ? {
          text: relevantHeading.text,
          level: relevantHeading.level,
          id: relevantHeading.id
        } : null,

        // Section metadata
        section: findRelevantSection(startLine, structure.sections),

        // Metadata
        metadata: {
          fileName,
          fileType: 'markdown',
          chunkSize: chunkText.length,
          hasCodeBlock: /```[\s\S]*?```/.test(chunkText),
          hasLinks: /\[.*?\]\(.*?\)/.test(chunkText),
          headingCount: (chunkText.match(/^#{1,6}\s/gm) || []).length
        },

        // Vector embedding for AI search
        embedding: embedding,

        // Generate search terms for better text search
        searchTerms: extractSearchTerms(chunkText, relevantHeading)
      };
    })
  );

  return {
    chunks: enrichedChunks,
    structure,
    stats: {
      totalChunks: enrichedChunks.length,
      avgChunkSize: Math.round(enrichedChunks.reduce((sum, c) => sum + c.content.length, 0) / enrichedChunks.length),
      totalHeadings: structure.headings.length,
      totalSections: structure.sections.length,
      hasEmbeddings: generateEmbeddings
    }
  };
}

/**
 * Find starting line number of chunk in original content
 */
function findChunkStartLine(chunkText, fullContent) {
  const firstLine = chunkText.split('\n')[0];
  const lines = fullContent.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(firstLine)) {
      return i + 1;
    }
  }
  
  return 1;
}

/**
 * Find relevant heading for a line number
 */
function findRelevantHeading(lineNumber, headings) {
  let relevantHeading = null;
  
  for (const heading of headings) {
    if (heading.line <= lineNumber) {
      relevantHeading = heading;
    } else {
      break;
    }
  }
  
  return relevantHeading;
}

/**
 * Find relevant section for a line number
 */
function findRelevantSection(lineNumber, sections) {
  for (const section of sections) {
    if (lineNumber >= section.startLine && lineNumber <= section.endLine) {
      return {
        startLine: section.startLine,
        endLine: section.endLine,
        heading: section.heading ? section.heading.text : null
      };
    }
  }
  return null;
}

/**
 * Calculate byte position for a line number
 */
function calculateBytePosition(content, lineNumber) {
  const lines = content.split('\n');
  let bytePos = 0;
  
  for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
    bytePos += Buffer.byteLength(lines[i] + '\n', 'utf8');
  }
  
  return bytePos;
}

/**
 * Generate embedding vector for text
 */
async function generateEmbedding(text) {
  try {
    const model = await initEmbeddingModel();
    
    // Truncate text nếu quá dài (model limit)
    const maxLength = 512;
    const truncatedText = text.substring(0, maxLength);
    
    const output = await model(truncatedText, { pooling: 'mean', normalize: true });
    
    // Convert to array
    return Array.from(output.data);
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Extract search terms from chunk
 */
function extractSearchTerms(chunkText, heading) {
  const terms = new Set();
  
  // Add heading terms
  if (heading) {
    heading.text.split(/\s+/).forEach(term => {
      if (term.length > 3) terms.add(term.toLowerCase());
    });
  }
  
  // Extract code block identifiers
  const codeBlocks = chunkText.match(/```(\w+)/g);
  if (codeBlocks) {
    codeBlocks.forEach(block => {
      const lang = block.replace('```', '');
      terms.add(lang);
    });
  }
  
  // Extract bold/italic terms (likely important)
  const emphasized = chunkText.match(/\*\*([^*]+)\*\*|\*([^*]+)\*/g);
  if (emphasized) {
    emphasized.forEach(term => {
      const cleanTerm = term.replace(/\*/g, '').trim();
      if (cleanTerm.length > 3) terms.add(cleanTerm.toLowerCase());
    });
  }
  
  // Extract links
  const links = chunkText.match(/\[([^\]]+)\]/g);
  if (links) {
    links.forEach(link => {
      const text = link.replace(/[\[\]]/g, '');
      text.split(/\s+/).forEach(word => {
        if (word.length > 3) terms.add(word.toLowerCase());
      });
    });
  }
  
  return Array.from(terms);
}

/**
 * Cleanup function để free memory
 */
function cleanup() {
  embeddingModel = null;
}

module.exports = {
  createMarkdownChunks,
  parseMarkdownStructure,
  generateEmbedding,
  cleanup
};
