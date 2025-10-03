import { GitHubAPIWrapper } from '../api/GitHubAPIWrapper';
import { StorageManager } from '../storage/StorageManager';
import { CacheManager } from '../cache/CacheManager';
import { QueryEngine } from '../query/QueryEngine';
import { TransactionEngine } from '../transaction/TransactionEngine';
import { ShardManager } from '../shard/ShardManager';
import { GitHubDBConfig, OperationOptions, QueryPredicate, Document } from '../types';
import { TransferOptions } from '../transaction/TransactionEngine';

export class GitHubDB {
  private api: GitHubAPIWrapper;
  private storage: StorageManager;
  private cache: CacheManager;
  private queryEngine: QueryEngine;
  private transactionEngine: TransactionEngine;
  private shardManager: ShardManager;
  private initialized: boolean = false;

  constructor(private config: GitHubDBConfig) {
    this.validateConfig();
    this.api = new GitHubAPIWrapper(config);
    this.storage = new StorageManager(this.api, config);
    this.cache = new CacheManager(config.cache ?? true);
    this.queryEngine = new QueryEngine();
    this.transactionEngine = new TransactionEngine(this.api, this.storage);
    this.shardManager = new ShardManager(this.api, config);
  }

  private validateConfig(): void {
    if (!this.config.token) {
      throw new Error('GitHub token is required');
    }
    if (!this.config.repo) {
      throw new Error('Repository name is required');
    }
    if (!['document', 'collection'].includes(this.config.mode)) {
      throw new Error('Mode must be either "document" or "collection"');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Validate token and repository access
      await this.api.validateToken();
      
      const repoExists = await this.api.repoExists();
      if (!repoExists) {
        throw new Error(`Repository ${this.config.repo} does not exist or you don't have access`);
      }

      this.initialized = true;
      console.log(`GitHubDB initialized successfully for repo: ${this.config.repo}`);
    } catch (error) {
      throw new Error(`Failed to initialize GitHubDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createCollection(collectionName: string, options?: { format?: 'json' | 'jsonl' }): Promise<void> {
    await this.ensureInitialized();
    
    try {
      const format = options?.format || this.config.format || 'json';
      const initialContent = format === 'jsonl' ? '' : '[]';
      
      // Create directory first
      await this.api.createDirectory(collectionName);
      
      // Create a sample file in the collection
      const sampleFile = `${collectionName}/sample.${format}`;
      await this.api.createFile(
        sampleFile,
        initialContent,
        `Create collection: ${collectionName}`
      );
    } catch (error: any) {
      throw new Error(`Failed to create collection ${collectionName}: ${error.message}`);
    }
  }

  async listCollections(): Promise<string[]> {
    await this.ensureInitialized();
    
    try {
      const contents = await this.api.getRepoContents('');
      return contents
        .filter(item => item.type === 'dir' && !item.name.startsWith('.'))
        .map(dir => dir.name);
    } catch (error: any) {
      throw new Error(`Failed to list collections: ${error.message}`);
    }
  }

  async set(path: string, data: Document, options?: OperationOptions): Promise<void> {
    await this.ensureInitialized();
    
    const fullPath = this.normalizePath(path);
    
    try {
      if (this.config.mode === 'document') {
        await this.storage.writeDocument(fullPath, data, options);
      } else {
        await this.storage.appendToCollection(fullPath, data, options);
      }
      
      this.cache.set(fullPath, data);
    } catch (error: any) {
      throw new Error(`Failed to set document ${path}: ${error.message}`);
    }
  }

  async get(path: string, options?: OperationOptions): Promise<Document | null> {
    await this.ensureInitialized();
    
    const fullPath = this.normalizePath(path);
    
    try {
      const cached = this.cache.get(fullPath);
      if (cached) return cached;

      const data = await this.storage.readDocument(fullPath, options);
      if (data) {
        this.cache.set(fullPath, data);
      }
      
      return data;
    } catch (error: any) {
      throw new Error(`Failed to get document ${path}: ${error.message}`);
    }
  }

  async delete(path: string): Promise<void> {
    await this.ensureInitialized();
    
    const fullPath = this.normalizePath(path);
    
    try {
      await this.api.deleteFile(fullPath, `Delete document: ${path}`);
      this.cache.delete(fullPath);
    } catch (error: any) {
      throw new Error(`Failed to delete document ${path}: ${error.message}`);
    }
  }

  async append(collectionPath: string, data: Document, options?: OperationOptions): Promise<void> {
    await this.ensureInitialized();
    
    const fullPath = this.normalizePath(collectionPath);
    
    try {
      await this.storage.appendToCollection(fullPath, data, options);
    } catch (error: any) {
      throw new Error(`Failed to append to collection ${collectionPath}: ${error.message}`);
    }
  }

  async getCollection(collectionPath: string, options?: OperationOptions): Promise<Document[]> {
    await this.ensureInitialized();
    
    const fullPath = this.normalizePath(collectionPath);
    
    try {
      return await this.storage.readCollection(fullPath, options);
    } catch (error: any) {
      throw new Error(`Failed to get collection ${collectionPath}: ${error.message}`);
    }
  }

  async remove(collectionPath: string, predicate: QueryPredicate): Promise<void> {
    await this.ensureInitialized();
    
    const fullPath = this.normalizePath(collectionPath);
    
    try {
      const documents = await this.getCollection(fullPath);
      const filtered = documents.filter(doc => !predicate(doc));
      
      // Write the filtered documents back to the collection
      const format = this.config.format || 'json';
      const filePath = `${fullPath}.${format}`;
      
      // Get the current file to get its SHA
      const currentFile = await this.api.getFile(filePath);
      if (!currentFile || !currentFile.sha) {
        throw new Error(`File ${filePath} not found or missing SHA`);
      }
      
      await this.api.updateFile(
        filePath,
        JSON.stringify(filtered, null, 2),
        `Remove documents matching predicate from ${collectionPath}`,
        currentFile.sha
      );
    } catch (error: any) {
      throw new Error(`Failed to remove from collection ${collectionPath}: ${error.message}`);
    }
  }

  async transfer(
    sourcePath: string, 
    destPath: string, 
    predicate: QueryPredicate, 
    options: Omit<TransferOptions, 'predicate'> = {}
  ): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.transactionEngine.transfer(sourcePath, destPath, {
        predicate,
        ...options
      });
    } catch (error: any) {
      throw new Error(`Failed to transfer from ${sourcePath} to ${destPath}: ${error.message}`);
    }
  }

  async query(collectionPath: string, predicate: QueryPredicate): Promise<Document[]> {
    await this.ensureInitialized();
    
    const fullPath = this.normalizePath(collectionPath);
    
    try {
      const documents = await this.getCollection(fullPath);
      return this.queryEngine.filter(documents, predicate);
    } catch (error: any) {
      throw new Error(`Failed to query collection ${collectionPath}: ${error.message}`);
    }
  }

  async autoShardIfSizeExceeded(maxSizeBytes: number): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.shardManager.autoShardIfSizeExceeded(maxSizeBytes);
    } catch (error: any) {
      throw new Error(`Failed to check sharding: ${error.message}`);
    }
  }

  async flushCache(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.storage.flushWriteQueue();
    } catch (error: any) {
      throw new Error(`Failed to flush cache: ${error.message}`);
    }
  }

  getRateLimitStatus(): { remaining: number; reset: number } {
    return this.api.getRateLimitStatus();
  }

  private normalizePath(path: string): string {
    return path.startsWith('/') ? path.substring(1) : path;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}