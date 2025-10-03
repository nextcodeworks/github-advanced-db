import dotenv from 'dotenv';
dotenv.config();

import { GitHubDB } from '..';

async function main() {
  try {
    // Initialize the database
    const db = new GitHubDB({
      token: process.env.GITHUB_PAT!, // Your Personal Access Token
      repo: 'nextcodeworks/mydb', // Format: "owner/repo"
      mode: 'document',
      cache: true,
      batchSize: 50,
      format: 'jsonl'
    });

    // Initialize and validate
    await db.initialize();

    // Create collections
    await db.createCollection('users', { format: 'jsonl' });
    await db.createCollection('logs', { format: 'json' });

    console.log('Collections created successfully');

    // Document operations
    await db.set('users/alice.json', {
      id: 'user_001',
      name: 'Alice',
      email: 'alice@example.com',
      password: 'secret123',
      age: 28
    }, { hashFields: ['password'] });

    // Read with un-hashing
    const user = await db.get('users/alice.json', { unhashFields: ['password'] });
    console.log('User retrieved:', user);

    // Collection operations
    await db.append('users/all.jsonl', {
      id: 'user_002',
      name: 'Bob',
      email: 'bob@example.com',
      password: 'password456',
      age: 32
    }, { hashFields: ['password'] });

    // Query collections
    const adults = await db.query('users/all.jsonl', doc => doc.age > 25);
    console.log('Adults:', adults);

    // Check rate limits
    const limits = db.getRateLimitStatus();
    console.log(`API calls remaining: ${limits.remaining}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main();