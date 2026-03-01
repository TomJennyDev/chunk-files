# Welcome to Markdown Renderer

## Introduction

This is a comprehensive sample markdown document that demonstrates various markdown features with **markdown-it** renderer. This document is designed to test scrolling, navigation, and table of contents functionality.

## Margin Collapse Test Section

This section demonstrates the margin collapse issue that can cause height calculation problems.

### Large Margin Element Test

Content with normal spacing above.

Content with normal spacing below.

### Another Section With Spacing

Testing how margins interact between adjacent elements.

Multiple paragraphs can cause margin collapse issues when calculating total height.

## Features Overview

### Text Formatting

You can use **bold text**, *italic text*, and ***bold italic text***. You can also use `inline code` for highlighting code snippets.

Markdown supports various text formatting options including **strong emphasis**, *emphasis*, and even ~~strikethrough~~ text. You can combine these styles to create rich, formatted content that enhances readability and comprehension.

### Lists

#### Unordered List

- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
  - Nested item 2.3
- Item 3
- Item 4

#### Ordered List

1. First item with detailed explanation
2. Second item with more context
3. Third item continuing the sequence
4. Fourth item completing the list
5. Fifth item for good measure

### Code Blocks

Here's a JavaScript example demonstrating function declarations:

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

greet('World');
```

Python code with class definitions:

```python
class Calculator:
    def __init__(self):
        self.result = 0
    
    def add(self, a, b):
        self.result = a + b
        return self.result
    
    def multiply(self, a, b):
        self.result = a * b
        return self.result

calc = Calculator()
print(f"Sum: {calc.add(5, 3)}")
print(f"Product: {calc.multiply(4, 7)}")
```

## Data Structures

### Tables

| Feature | Support | Description | Priority |
|---------|---------|-------------|----------|
| Headers | ✓ | H1-H6 headers supported | High |
| Lists | ✓ | Ordered and unordered | High |
| Code | ✓ | Inline and blocks | Medium |
| Tables | ✓ | Full table support | Medium |
| Images | ✓ | Image embedding | Low |

### Complex Table

| Language | Year | Paradigm | Static Typing | Use Case |
|----------|------|----------|---------------|----------|
| JavaScript | 1995 | Multi-paradigm | No | Web development |
| TypeScript | 2012 | Multi-paradigm | Yes | Large-scale apps |
| Python | 1991 | Multi-paradigm | No | Data science, AI |
| Rust | 2010 | Multi-paradigm | Yes | Systems programming |
| Go | 2009 | Imperative | Yes | Backend services |

## Links and References

You can create [links to external sites](https://example.com) and reference other sections. External resources are crucial for providing additional context and information.

Visit [GitHub](https://github.com) for open-source projects, or check out [Stack Overflow](https://stackoverflow.com) for development questions.

## Blockquotes and Citations

> This is a blockquote demonstrating how to quote text from other sources.
> It can span multiple lines and maintain proper formatting.
>
> > Nested blockquotes are also supported.
> > This allows for quoting within quotes.

Another example:

> "The only way to do great work is to love what you do." - Steve Jobs

## Horizontal Rules

---

## Advanced Features

### Task Lists

Project tasks:
- [x] Set up development environment
- [x] Create project structure
- [x] Implement markdown renderer
- [ ] Add syntax highlighting
- [ ] Implement search functionality
- [ ] Add export features
- [ ] Write documentation
- [ ] Deploy to production

### Code Examples

TypeScript interface definitions:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: User;
  tags: string[];
  published: boolean;
}

function getUserPosts(userId: string): Promise<Post[]> {
  return fetch(`/api/users/${userId}/posts`)
    .then(res => res.json());
}
```

## Web Development

### HTML Structure

HTML is the backbone of web development. Here's a basic structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>Welcome</h1>
  </header>
  <main>
    <p>Content goes here</p>
  </main>
  <script src="app.js"></script>
</body>
</html>
```

### CSS Styling

CSS brings life to HTML through styling:

```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.button:hover {
  background-color: #0056b3;
}
```

## Backend Development

### Database Queries

SQL examples for common operations:

```sql
-- Select users with their posts
SELECT u.id, u.name, COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.author_id
WHERE u.active = true
GROUP BY u.id, u.name
ORDER BY post_count DESC
LIMIT 10;

-- Create table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Development

RESTful API example:

```javascript
const express = require('express');
const app = express();

app.use(express.json());

// GET all items
app.get('/api/items', async (req, res) => {
  try {
    const items = await db.query('SELECT * FROM items');
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create item
app.post('/api/items', async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO items (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## React Components

### Functional Components

Modern React uses functional components with hooks:

```jsx
import React, { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch(`/api/users/${userId}`);
        const data = await response.json();
        setUser(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>No user found</div>;

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <p>Role: {user.role}</p>
    </div>
  );
}

export default UserProfile;
```

## Testing

### Unit Tests

Testing is crucial for maintaining code quality:

```javascript
describe('Calculator', () => {
  test('adds two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
  });

  test('subtracts two numbers correctly', () => {
    expect(subtract(5, 3)).toBe(2);
  });

  test('multiplies two numbers correctly', () => {
    expect(multiply(4, 5)).toBe(20);
  });

  test('divides two numbers correctly', () => {
    expect(divide(10, 2)).toBe(5);
  });

  test('throws error when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });
});
```

## Performance Optimization

### Memoization

Optimize React components with memoization:

```jsx
import React, { useMemo, useCallback } from 'react';

function ExpensiveComponent({ items, filter }) {
  const filteredItems = useMemo(() => {
    console.log('Filtering items...');
    return items.filter(item => item.category === filter);
  }, [items, filter]);

  const handleClick = useCallback((id) => {
    console.log('Item clicked:', id);
  }, []);

  return (
    <div>
      {filteredItems.map(item => (
        <div key={item.id} onClick={() => handleClick(item.id)}>
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

## Data Structures and Algorithms

### Binary Search

Efficient search algorithm:

```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1

# Example usage
numbers = [1, 3, 5, 7, 9, 11, 13, 15]
result = binary_search(numbers, 7)
print(f"Found at index: {result}")
```

### Sorting Algorithms

Quick sort implementation:

```python
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    
    return quick_sort(left) + middle + quick_sort(right)

# Example
unsorted = [3, 6, 8, 10, 1, 2, 1]
sorted_arr = quick_sort(unsorted)
print(f"Sorted: {sorted_arr}")
```

## Security Best Practices

### Input Validation

Always validate and sanitize user input:

```javascript
function sanitizeInput(input) {
  // Remove HTML tags
  const withoutTags = input.replace(/<[^>]*>/g, '');
  
  // Escape special characters
  const escaped = withoutTags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return escaped;
}

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
```

### Authentication

JWT token implementation:

```javascript
const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email,
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const user = verifyToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  
  req.user = user;
  next();
}
```

## Design Patterns

### Singleton Pattern

Ensure only one instance exists:

```javascript
class Database {
  constructor() {
    if (Database.instance) {
      return Database.instance;
    }
    
    this.connection = null;
    Database.instance = this;
  }
  
  connect() {
    if (!this.connection) {
      this.connection = createConnection();
      console.log('Database connected');
    }
    return this.connection;
  }
}

const db1 = new Database();
const db2 = new Database();
console.log(db1 === db2); // true
```

### Observer Pattern

Implement event-driven architecture:

```javascript
class EventEmitter {
  constructor() {
    this.events = {};
  }
  
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }
  
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(data));
    }
  }
  
  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event]
        .filter(l => l !== listener);
    }
  }
}

// Usage
const emitter = new EventEmitter();
emitter.on('userLogin', (user) => {
  console.log(`User ${user.name} logged in`);
});
emitter.emit('userLogin', { name: 'John' });
```

## Deployment

### Docker Configuration

Containerize your application:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

Docker Compose for multi-container setup:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:password@db:5432/myapp
    depends_on:
      - db
  
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Conclusion

This comprehensive markdown document demonstrates various features that can be rendered using markdown-it. The sidebar navigation allows you to jump to any section quickly, making it easy to navigate through extensive documentation.

### Key Takeaways

1. Markdown is a powerful formatting language
2. Code blocks support multiple languages
3. Tables organize data effectively
4. Lists structure information clearly
5. Links connect related content

### Future Enhancements

Planned improvements for this renderer:

- [ ] Add search functionality
- [ ] Implement print styles
- [ ] Add export to PDF
- [ ] Support for diagrams
- [ ] Custom themes
- [ ] Collaborative editing

### Resources

Additional learning materials:

- [Markdown Guide](https://www.markdownguide.org)
- [GitHub Markdown](https://docs.github.com/en/get-started/writing-on-github)
- [CommonMark Spec](https://commonmark.org)

## Final Notes

Thank you for exploring this comprehensive markdown demonstration! This document showcases the versatility and power of markdown for creating rich, well-structured content. Whether you're writing documentation, blog posts, or technical guides, markdown provides an excellent balance between simplicity and functionality.

Remember to keep your content organized, use headings appropriately, and leverage markdown's features to create clear, readable documents that serve your audience well.
