import { useEffect, useState } from 'react';
import { Box } from '@mantine/core';

export function DynamicContent() {
  const [expanded, setExpanded] = useState(false);
  const [lateContent, setLateContent] = useState('');

  // Simulate late content loading (causes height change)
  useEffect(() => {
    const timer = setTimeout(() => {
      setLateContent('This content loaded 2 seconds later and changes the height!');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Box style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ddd' }}>
      <h3>Dynamic Content Test</h3>
      
      {/* Collapsible section that changes height */}
      <button 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '0.5rem 1rem', 
          marginBottom: '1rem',
          cursor: 'pointer' 
        }}
      >
        {expanded ? 'Collapse' : 'Expand'} Section
      </button>
      
      {expanded && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f0f0f0',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <p>This is expanded content that adds height!</p>
          <p>Multiple paragraphs to make it taller.</p>
          <p>Even more content here.</p>
        </div>
      )}

      {/* Late loading content */}
      {lateContent && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          backgroundColor: '#e3f2fd' 
        }}>
          {lateContent}
        </div>
      )}

      {/* Image without dimensions - causes reflow when loaded */}
      <div style={{ marginTop: '1rem' }}>
        <img 
          src="https://via.placeholder.com/800x400" 
          alt="Dynamic image"
          style={{ width: '100%', display: 'block' }}
        />
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            max-height: 0;
            opacity: 0;
          }
          to {
            max-height: 500px;
            opacity: 1;
          }
        }
      `}</style>
    </Box>
  );
}
