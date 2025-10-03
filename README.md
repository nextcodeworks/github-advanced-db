# GitHub JSON DB

A production-ready, MongoDB-like database built directly on GitHub repositories. Store, query, and manage JSON/JSONL documents with atomic transactions, field-level encryption, and multi-format support. Perfect for applications needing simple, version-controlled database storage with the reliability of GitHub's infrastructure.

## 🚀 Features

- **🗄️ Dual Storage Modes**: Document mode (MongoDB-style) and Collection mode (batch operations)
- **🔄 Multi-Format Support**: JSON, JSONL, CSV, and YAML with automatic conversion
- **🔒 Field-Level Encryption**: AES-256 encryption for sensitive fields
- **⚡ Atomic Transactions**: Safe transfers between files with rollback protection
- **📊 Advanced Querying**: In-memory filtering with predicate functions
- **🚀 Optimized Performance**: Smart caching, batching, and rate limit management
- **💪 Full TypeScript Support**: Complete type safety throughout the API
- **🔍 Automatic Sharding**: Repository size monitoring and auto-sharding
- **📝 GitHub Native**: Leverages GitHub's version control and collaboration features

## 📦 Installation

```bash
npm install github-json-db
```

## 🏁 Quick Start

```typescript
import { GitHubDB } from 'github-json-db';

// Initialize the database
const db = new GitHubDB({
  token: process.env.GITHUB_TOKEN!,
  repo: 'your-username/your-repo', // Format: "owner/repo"
  mode: 'document', // or 'collection'
  cache: true,
  batchSize: 50,
  format: 'jsonl' // Default format for new files
});

await db.initialize();

// Create a collection
await db.createCollection('users', { format: 'jsonl' });

// Store documents with encrypted fields
await db.set('users/alice.json', {
  id: 'user_001',
  name: 'Alice',
  email: 'alice@example.com',
  password: 'secret123',
  age: 28
}, { hashFields: ['password'] });

// Query documents
const adults = await db.query('users', doc => doc.age >= 18);
```

## ⚙️ Configuration

### GitHubDB Constructor Options

```typescript
interface GitHubDBConfig {
  // Required
  token: string;           // GitHub Personal Access Token
  repo: string;           // Repository name (format: "owner/repo")
  
  // Optional
  mode?: 'document' | 'collection';  // Default: 'document'
  cache?: boolean;                   // Default: true
  batchSize?: number;                // Default: 50
  format?: 'json' | 'jsonl';         // Default: 'json'
  baseBranch?: string;               // Default: 'main'
  owner?: string;                    // Auto-extracted from repo if not provided
}
```

### Environment Variables

```bash
# Required
GITHUB_TOKEN=ghp_your_personal_access_token_here

# Optional
GITHUB_REPO=your-username/your-repo
```

## 📚 API Reference

### Core Database Operations

#### `initialize()`
Validates configuration and GitHub access. Must be called before other operations.

```typescript
await db.initialize();
// Throws error if token is invalid or repo doesn't exist
```

#### `createCollection(collectionName, options)`
Creates a new collection (directory) with sample file.

```typescript
await db.createCollection('users', { format: 'jsonl' });
await db.createCollection('logs', { format: 'json' });

// Options
interface CreateCollectionOptions {
  format?: 'json' | 'jsonl'; // Default: uses db config format
}
```

#### `listCollections()`
Returns array of all collection names in the repository.

```typescript
const collections = await db.listCollections();
// Returns: ['users', 'logs', 'products']
```

### Document Operations

#### `set(path, data, options)`
Creates or updates a document at the specified path.

```typescript
// Document mode - creates individual files
await db.set('users/alice.json', {
  name: 'Alice',
  email: 'alice@example.com',
  password: 'secret123'
}, { 
  hashFields: ['password'],
  format: 'json' // Override default format
});

// Collection mode - appends to collection file
await db.set('users/all.jsonl', {
  name: 'Bob',
  email: 'bob@example.com'
});
```

#### `get(path, options)`
Retrieves a document from the specified path.

```typescript
const user = await db.get('users/alice.json', {
  unhashFields: ['password'] // Decrypt encrypted fields
});

// Returns: { name: 'Alice', email: 'alice@example.com', password: 'secret123' }
```

#### `delete(path)`
Deletes a document from the repository.

```typescript
await db.delete('users/alice.json');
```

### Collection Operations

#### `append(collectionPath, data, options)`
Appends a document to a collection file (JSONL format recommended).

```typescript
await db.append('users/logins.jsonl', {
  userId: 'user_001',
  action: 'login',
  timestamp: new Date().toISOString(),
  ip: '192.168.1.1'
}, { 
  hashFields: ['ip'] // Encrypt sensitive fields
});
```

#### `getCollection(collectionPath, options)`
Retrieves all documents from a collection file.

```typescript
const users = await db.getCollection('users/all.jsonl', {
  unhashFields: ['password']
});

// Returns: Array of user objects
```

#### `remove(collectionPath, predicate)`
Removes documents from a collection that match the predicate.

```typescript
// Remove inactive users
await db.remove('users/all.jsonl', user => user.status === 'inactive');

// Remove documents older than 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
await db.remove('logs/events.jsonl', log => new Date(log.timestamp) < thirtyDaysAgo);
```

### Query Operations

#### `query(collectionPath, predicate)`
Queries a collection with a filter function.

```typescript
// Simple equality check
const alice = await db.query('users', user => user.name === 'Alice');

// Complex conditions
const activeAdults = await db.query('users', user => 
  user.age >= 18 && user.status === 'active'
);

// Date range queries
const recentLogs = await db.query('logs', log =>
  new Date(log.timestamp) > new Date('2024-01-01')
);

// Array operations
const premiumUsers = await db.query('users', user =>
  ['premium', 'vip'].includes(user.tier)
);
```

#### Advanced Query Examples

```typescript
// Chaining multiple conditions
const results = await db.query('products', product => 
  product.price > 100 && 
  product.category === 'electronics' &&
  product.stock > 0 &&
  product.tags.includes('featured')
);

// Text search (case insensitive)
const searchResults = await db.query('articles', article =>
  article.title.toLowerCase().includes('javascript') ||
  article.content.toLowerCase().includes('typescript')
);

// Nested object queries
const usersWithAddress = await db.query('users', user =>
  user.address?.city === 'New York' && user.address.zipCode.startsWith('100')
);
```

### Transaction Operations

#### `transfer(sourcePath, destPath, options)`
Atomically transfers documents between files with optional format conversion.

```typescript
// Basic transfer
await db.transfer('users/new.jsonl', 'users/processed.jsonl', {
  predicate: user => user.processed === true
});

// Transfer with format conversion
await db.transfer('logs/raw.json', 'logs/processed.jsonl', {
  predicate: log => log.severity === 'ERROR',
  conversion: {
    sourceFormat: 'json',
    targetFormat: 'jsonl',
    fieldMapping: {
      'log_id': 'id',
      'message_content': 'message'
    }
  }
});

// Transfer with data transformation
await db.transfer('products/raw.jsonl', 'products/enriched.jsonl', {
  predicate: product => product.price > 0,
  transform: product => ({
    ...product,
    price: Math.round(product.price * 100), // Convert to cents
    currency: 'USD',
    lastUpdated: new Date().toISOString()
  })
});
```

#### Transfer Options

```typescript
interface TransferOptions {
  predicate: (doc: any) => boolean;    // Required: Filter function
  conversion?: ConversionOptions;      // Optional: Format conversion
  transform?: (doc: any) => any;       // Optional: Data transformation
  batchSize?: number;                  // Optional: Batch processing size
}

interface ConversionOptions {
  sourceFormat: 'json' | 'jsonl' | 'csv' | 'yaml';
  targetFormat: 'json' | 'jsonl' | 'csv' | 'yaml';
  fieldMapping?: Record<string, string>;  // Rename fields during conversion
  filter?: (doc: any) => boolean;         // Additional filtering
  transform?: (doc: any) => any;          // Additional transformation
  timestampField?: string;                // Add timestamp field
}
```

### Utility Operations

#### `autoShardIfSizeExceeded(maxSizeBytes)`
Automatically creates new repositories when current repo approaches size limits.

```typescript
// Shard if repository exceeds 4GB
await db.autoShardIfSizeExceeded(4 * 1024 * 1024 * 1024);
```

#### `flushCache()`
Flushes all pending write operations from the cache queue.

```typescript
await db.flushCache();
```

#### `getRateLimitStatus()`
Returns current GitHub API rate limit information.

```typescript
const limits = db.getRateLimitStatus();
console.log(`Remaining requests: ${limits.remaining}`);
console.log(`Reset time: ${new Date(limits.reset * 1000).toISOString()}`);
```

## 🔒 Field-Level Encryption

### Hashing Options

```typescript
// Write with encryption
await db.set('users/sensitive.json', {
  username: 'alice',
  password: 'secret123',
  apiKey: 'sk_live_123456',
  socialSecurity: '123-45-6789'
}, {
  hashFields: ['password', 'apiKey', 'socialSecurity']
});

// Read with decryption
const user = await db.get('users/sensitive.json', {
  unhashFields: ['password', 'apiKey'] // Only decrypt specific fields
});
```

### Custom Encryption Key

```typescript
import { HashManager } from 'github-json-db';

// Use custom encryption key
const hashManager = new HashManager('your-custom-32-byte-encryption-key');

// The library automatically generates a secure key if not provided
```

## 🔄 Format Conversion

### Supported Formats

- **JSON**: Standard JSON format, good for small datasets
- **JSONL**: JSON Lines format, perfect for large append-only collections
- **CSV**: Comma-separated values, great for spreadsheet integration
- **YAML**: Human-readable format, good for configuration files

### Conversion Examples

```typescript
// JSON to JSONL
await db.transfer('data/config.json', 'data/stream.jsonl', {
  predicate: doc => doc.active === true,
  conversion: {
    sourceFormat: 'json',
    targetFormat: 'jsonl'
  }
});

// JSONL to CSV with field mapping
await db.transfer('logs/events.jsonl', 'logs/events.csv', {
  predicate: doc => doc.timestamp > '2024-01-01',
  conversion: {
    sourceFormat: 'jsonl',
    targetFormat: 'csv',
    fieldMapping: {
      'event_id': 'id',
      'event_type': 'type',
      'event_timestamp': 'timestamp'
    }
  }
});

// CSV to JSON with transformation
await db.transfer('import/products.csv', 'database/products.json', {
  predicate: doc => doc.price > 0,
  conversion: {
    sourceFormat: 'csv',
    targetFormat: 'json',
    transform: doc => ({
      ...doc,
      price: parseFloat(doc.price),
      inStock: doc.stock > 0
    })
  }
});
```

## 🏗️ Storage Architecture

### Repository Structure

```
your-repo/
├── users/
│   ├── alice.json              # Document mode (individual files)
│   ├── bob.json
│   └── all.jsonl               # Collection mode (batch file)
├── logs/
│   ├── 2024-01-access.jsonl
│   └── 2024-01-errors.json
├── products/
│   └── catalog.jsonl
└── .index/                     # Internal indexes (auto-generated)
    └── users_index.json
```

### Storage Modes

#### Document Mode (MongoDB-style)
- One file per document
- Best for: Random access, concurrent updates, large documents
- File extensions: `.json`, `.jsonl`

#### Collection Mode (Batch style)
- Multiple documents per file
- Best for: Append-heavy workloads, batch processing, logs
- File extensions: `.jsonl` (recommended), `.json`

## 📈 Performance Optimization

### Caching Strategy

```typescript
const db = new GitHubDB({
  token: process.env.GITHUB_TOKEN!,
  repo: 'your/repo',
  cache: true,           // Enable read caching
  batchSize: 100         // Batch write operations
});

// Manual cache control
await db.flushCache();   // Force write all pending changes
```

### Rate Limit Management

```typescript
// Monitor rate limits
const limits = db.getRateLimitStatus();
if (limits.remaining < 100) {
  console.log('Approaching rate limit, slowing down operations');
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

### Batch Operations

```typescript
// Process large datasets in batches
const largeDataset = [...]; // Thousands of documents

for (let i = 0; i < largeDataset.length; i += 100) {
  const batch = largeDataset.slice(i, i + 100);
  
  await Promise.all(
    batch.map(doc => 
      db.append('data/collection.jsonl', doc)
    )
  );
  
  // Respect rate limits
  if (i % 1000 === 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

## 🛠️ Advanced Usage

### Custom Formatters

```typescript
import { FormatConverter, Formatter } from 'github-json-db';

class CustomFormatter implements Formatter {
  parse(content: string): any[] {
    // Custom parsing logic
    return content.split('|').map(item => JSON.parse(item));
  }
  
  serialize(documents: any[]): string {
    return documents.map(doc => JSON.stringify(doc)).join('|');
  }
  
  getFileExtension(): string {
    return 'custom';
  }
}

// Register custom formatter
const converter = new FormatConverter();
converter.registerFormatter('custom', new CustomFormatter());
```

### Error Handling

```typescript
try {
  await db.initialize();
  await db.set('data/doc.json', { value: 'test' });
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Handle rate limits
    console.log('Rate limit exceeded, retrying later');
  } else if (error.message.includes('not found')) {
    // Handle missing files/repos
    console.log('Repository or file not found');
  } else if (error.message.includes('invalid token')) {
    // Handle authentication issues
    console.log('Invalid GitHub token');
  } else {
    // Generic error handling
    console.error('Operation failed:', error.message);
  }
}
```

### Integration with Web Frameworks

#### Express.js Example

```typescript
import express from 'express';
import { GitHubDB } from 'github-json-db';

const app = express();
const db = new GitHubDB({
  token: process.env.GITHUB_TOKEN!,
  repo: 'your-username/your-api-data'
});

await db.initialize();

app.get('/users/:id', async (req, res) => {
  try {
    const user = await db.get(`users/${req.params.id}.json`);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/users', async (req, res) => {
  try {
    await db.set(`users/${req.body.id}.json`, req.body, {
      hashFields: ['password', 'email']
    });
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 🔍 Monitoring and Debugging

### Logging Operations

```typescript
// Add logging to track operations
const originalSet = db.set.bind(db);
db.set = async (path, data, options) => {
  console.log(`Setting document: ${path}`);
  const start = Date.now();
  try {
    const result = await originalSet(path, data, options);
    console.log(`Document set successfully in ${Date.now() - start}ms`);
    return result;
  } catch (error) {
    console.error(`Failed to set document ${path}:`, error);
    throw error;
  }
};
```

### Performance Monitoring

```typescript
// Track operation timings
const timings = {
  set: [],
  get: [],
  query: []
};

// Wrap operations to collect metrics
const trackTiming = (operation, fn) => async (...args) => {
  const start = Date.now();
  try {
    const result = await fn(...args);
    timings[operation].push(Date.now() - start);
    return result;
  } catch (error) {
    timings[operation].push({ error: error.message, duration: Date.now() - start });
    throw error;
  }
};

db.set = trackTiming('set', db.set);
db.get = trackTiming('get', db.get);
```

## 📋 Best Practices

### 1. Repository Organization
- Use descriptive collection names
- Group related data in the same collection
- Use subdirectories for complex data hierarchies

### 2. File Format Selection
- Use JSONL for large, append-only datasets
- Use JSON for small datasets or configuration files
- Consider CSV for data that needs spreadsheet integration

### 3. Security
- Always encrypt sensitive fields (passwords, API keys, PII)
- Use fine-grained GitHub tokens with minimal permissions
- Regularly rotate encryption keys in production

### 4. Performance
- Enable caching for read-heavy workloads
- Use appropriate batch sizes for your rate limits
- Monitor GitHub API rate limits and adjust accordingly

### 5. Error Handling
- Always wrap operations in try-catch blocks
- Implement retry logic for rate limit errors
- Validate data before writing to the repository

## 🐛 Troubleshooting

### Common Issues

**Rate Limit Errors**
```typescript
// Solution: Implement retry logic
const withRetry = async (operation, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (error.message.includes('rate limit') && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      } else {
        throw error;
      }
    }
  }
};

await withRetry(() => db.set('data/doc.json', { value: 'test' }));
```

**File Not Found Errors**
```typescript
// Solution: Check file existence before operations
const safeGet = async (path) => {
  try {
    return await db.get(path);
  } catch (error) {
    if (error.message.includes('not found')) {
      return null;
    }
    throw error;
  }
};
```

**Authentication Errors**
- Verify your GitHub token has repo permissions
- Check token expiration
- Ensure repository exists and is accessible

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## 🆘 Support

- **Documentation**: [GitHub Repository](https://github.com/your-username/github-json-db)
- **Issues**: [GitHub Issues](https://github.com/your-username/github-json-db/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/github-json-db/discussions)

---

**GitHub JSON DB** - Simple, reliable database storage powered by GitHub repositories.