import { GitHubAPIWrapper } from '../api/GitHubAPIWrapper';
import { HashManager } from '../crypto/HashManager';
import { GitHubDBConfig, OperationOptions, Document } from '../types';
export class StorageManager {
  private hashManager: HashManager;
  private writeQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;

  constructor(
    private api: GitHubAPIWrapper,
    private config: GitHubDBConfig
  ) {
    // Use a fixed secret key for consistent hashing
    // In a production environment, you might want to pass this as a configuration
    const secretKey = process.env.HASH_SECRET_KEY || 'default-secret-key-for-development';
    this.hashManager = new HashManager(secretKey);
  }

  async writeDocument(path: string, data: Document, options?: OperationOptions): Promise<void> {
    const processedData = this.processDataBeforeWrite(data, options?.hashFields);
    const content = this.serializeContent(processedData, this.getFormat(path, options));
    await this.enqueueWrite(path, content, `Write document: ${path}`);
  }

  async readDocument(path: string, options?: OperationOptions): Promise<Document | null> {
    const file = await this.api.getFile(path);
    if (!file) return null;

    const format = this.getFormat(path, options);
    const data = this.parseContent(file.content, format);
    
    return this.processDataAfterRead(data, options?.unhashFields);
  }

  async appendToCollection(path: string, data: Document, options?: OperationOptions): Promise<void> {
    const processedData = this.processDataBeforeWrite(data, options?.hashFields);
    const format = this.getFormat(path, options);
    
    try {
      // First, try to get the file to check if it exists
      await this.api.getFile(path);
      
      // If we get here, file exists - proceed with append
      const line = format === 'jsonl' 
        ? JSON.stringify(processedData) + '\n'
        : await this.handleJsonAppend(path, processedData);

      await this.enqueueWrite(path, line, `Append to collection: ${path}`, true);
    } catch (error) {
      // If file doesn't exist, create it with initial content
      if ((error as any)?.response?.status === 404) {
        const initialContent = format === 'jsonl' 
          ? JSON.stringify(processedData) + '\n'
          : JSON.stringify([processedData], null, 2);
          
        await this.enqueueWrite(path, initialContent, `Create collection: ${path}`);
      } else {
        throw error;
      }
    }
  }

  async readCollection(path: string, options?: OperationOptions): Promise<Document[]> {
    const file = await this.api.getFile(path);
    if (!file) return [];

    const format = this.getFormat(path, options);
    const documents = this.parseContent(file.content, format);
    
    return Array.isArray(documents) 
      ? documents.map(doc => this.processDataAfterRead(doc, options?.unhashFields))
      : [this.processDataAfterRead(documents, options?.unhashFields)];
  }

  async writeCollection(path: string, documents: Document[]): Promise<void> {
    const content = this.serializeContent(documents, this.getFormat(path));
    await this.enqueueWrite(path, content, `Write collection: ${path}`);
  }

  private processDataBeforeWrite(data: Document, hashFields?: string[]): Document {
    if (!hashFields || hashFields.length === 0) return { ...data };

    const processed = { ...data };
    for (const field of hashFields) {
      if (processed[field]) {
        processed[field] = this.hashManager.hash(processed[field]);
      }
    }
    return processed;
  }

  private processDataAfterRead(data: Document, unhashFields?: string[]): Document {
    if (!unhashFields || unhashFields.length === 0) return data;

    const processed = { ...data };
    for (const field of unhashFields) {
      if (processed[field]) {
        processed[field] = this.hashManager.unhash(processed[field]);
      }
    }
    return processed;
  }

  private getFormat(path: string, options?: OperationOptions): 'json' | 'jsonl' {
    return options?.format || (path.endsWith('.jsonl') ? 'jsonl' : 'json');
  }

  private serializeContent(data: any, format: 'json' | 'jsonl'): string {
    return format === 'jsonl' 
      ? Array.isArray(data) ? data.map(item => JSON.stringify(item)).join('\n') : JSON.stringify(data)
      : JSON.stringify(data, null, 2);
  }

  private parseContent(content: string, format: 'json' | 'jsonl'): any {
    if (format === 'jsonl') {
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    }
    return content ? JSON.parse(content) : [];
  }

  private async handleJsonAppend(path: string, newData: Document): Promise<string> {
    try {
      const existing = await this.readCollection(path);
      existing.push(newData);
      return this.serializeContent(existing, 'json');
    } catch (error) {
      // If file doesn't exist, return just the new data as an array
      if ((error as any)?.response?.status === 404) {
        return this.serializeContent([newData], 'json');
      }
      throw error;
    }
  }

  private async enqueueWrite(
    path: string, 
    content: string, 
    message: string, 
    append: boolean = false
  ): Promise<void> {
    this.writeQueue.push(async () => {
      try {
        const existing = await this.api.getFile(path).catch(() => null);
        
        if (append && existing) {
          // For append operations, get the existing content and append to it
          const existingContent = existing.content || '';
          const newContent = existingContent + content;
          await this.api.updateFile(path, newContent, message, existing.sha!);
        } else if (existing) {
          // For non-append operations with existing file, update it
          await this.api.updateFile(path, content, message, existing.sha!);
        } else {
          // For new files, create them
          await this.api.createFile(path, content, message);
        }
      } catch (error) {
        console.error(`Failed to write to ${path}:`, error);
        throw error;
      }
    });

    if (!this.isProcessingQueue) {
      await this.processWriteQueue();
    }
  } 

  private async processWriteQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    while (this.writeQueue.length > 0) {
      const writeOperation = this.writeQueue.shift();
      if (writeOperation) {
        await writeOperation();
      }
    }
    this.isProcessingQueue = false;
  }

  async flushWriteQueue(): Promise<void> {
    await this.processWriteQueue();
  }
}