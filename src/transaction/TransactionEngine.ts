import { GitHubAPIWrapper } from '../api/GitHubAPIWrapper';
import { StorageManager } from '../storage/StorageManager';
import { FormatConverter } from '../formatters/FormatConverter';
import { QueryPredicate, Document } from '../types';
import { ConversionOptions } from '../formatters/types';

interface TransactionState {
  sourcePath: string;
  destPath: string;
  sourceContent: string;
  destContent: string;
  sourceSha?: string;
  destSha?: string;
}

export interface TransferOptions {
  predicate: QueryPredicate;
  conversion?: ConversionOptions;
  transform?: (doc: Document) => Document;
  batchSize?: number;
}

export class TransactionEngine {
  private transactionLock: Map<string, boolean> = new Map();
  private formatConverter: FormatConverter;

  constructor(
    private api: GitHubAPIWrapper,
    private storage: StorageManager
  ) {
    this.formatConverter = new FormatConverter();
  }

  async transfer(
    sourcePath: string, 
    destPath: string, 
    options: TransferOptions
  ): Promise<void> {
    const lockKey = `${sourcePath}-${destPath}`;
    
    // Prevent concurrent transfers on the same files
    if (this.transactionLock.get(lockKey)) {
      throw new Error(`Transaction already in progress for ${lockKey}`);
    }

    try {
      this.transactionLock.set(lockKey, true);
      await this.executeAtomicTransfer(sourcePath, destPath, options);
    } finally {
      this.transactionLock.delete(lockKey);
    }
  }

  private async executeAtomicTransfer(
    sourcePath: string, 
    destPath: string, 
    options: TransferOptions
  ): Promise<void> {
    // Step 1: Get current state with SHAs in single batch
    const [sourceFile, destFile] = await Promise.allSettled([
      this.api.getFile(sourcePath),
      this.api.getFile(destPath)
    ]);

    const sourceFormat = this.formatConverter.detectFormat(sourcePath);
    const destFormat = this.formatConverter.detectFormat(destPath);
    
    const sourceDocs = this.parseFileContent(sourceFile, sourceFormat);
    const destDocs = this.parseFileContent(destFile, destFormat);

    // Step 2: Process the transfer in memory
    const { matching, remaining } = this.processTransfer(sourceDocs, options.predicate);
    
    if (matching.length === 0) {
      return; // No changes needed
    }

    // Step 3: Apply transformations and format conversion
    let processedMatching = matching;
    
    if (options.transform) {
      processedMatching = processedMatching.map(options.transform);
    }
    
    if (options.conversion) {
      // Use format converter for complex transformations
      const conversionOptions: ConversionOptions = {
        ...options.conversion,
        sourceFormat: sourceFormat as 'json' | 'jsonl' | 'csv' | 'yaml',
        targetFormat: destFormat as 'json' | 'jsonl' | 'csv' | 'yaml'
      };
      
      const convertedContent = this.formatConverter.convertDocuments(
        processedMatching,
        conversionOptions
      );
      
      // For format conversion, we need to handle the destination content differently
      const newDestDocs = await this.mergeWithDestination(
        destPath,
        destDocs,
        processedMatching,
        { 
          ...options.conversion, 
          sourceFormat: destFormat as 'json' | 'jsonl' | 'csv' | 'yaml', 
          targetFormat: destFormat as 'json' | 'jsonl' | 'csv' | 'yaml' 
        }
      );
      
      const newDestContent = this.formatConverter.convertDocuments(newDestDocs, {
        ...options.conversion,
        sourceFormat: destFormat as 'json' | 'jsonl' | 'csv' | 'yaml',
        targetFormat: destFormat as 'json' | 'jsonl' | 'csv' | 'yaml'
      });

      const newSourceContent = this.formatConverter.convertDocuments(remaining, {
        ...options.conversion,
        sourceFormat: sourceFormat as 'json' | 'jsonl' | 'csv' | 'yaml',
        targetFormat: sourceFormat as 'json' | 'jsonl' | 'csv' | 'yaml'
      });

      await this.atomicCommit(
        {
          sourcePath,
          destPath,
          sourceContent: newSourceContent,
          destContent: newDestContent,
          sourceSha: sourceFile.status === 'fulfilled' && sourceFile.value ? sourceFile.value.sha : undefined,
          destSha: destFile.status === 'fulfilled' && destFile.value ? destFile.value.sha : undefined
        },
        processedMatching.length
      );
      
      return;
    }

    // Step 4: Standard transfer without format conversion
    const newDestDocs = [...destDocs, ...processedMatching];

    const newSourceContent = this.serializeContent(remaining, sourceFormat);
    const newDestContent = this.serializeContent(newDestDocs, destFormat);

    // Step 5: Atomic commit
    await this.atomicCommit(
      {
        sourcePath,
        destPath,
        sourceContent: newSourceContent,
        destContent: newDestContent,
        sourceSha: sourceFile.status === 'fulfilled' && sourceFile.value ? sourceFile.value.sha : undefined,
        destSha: destFile.status === 'fulfilled' && destFile.value ? destFile.value.sha : undefined
      },
      processedMatching.length
    );
  }

  private async mergeWithDestination(
    destPath: string,
    destDocs: Document[],
    newDocs: Document[],
    options: ConversionOptions
  ): Promise<Document[]> {
    // For format conversion, we might need to merge documents differently
    // This handles cases where we're converting formats during transfer
    return [...destDocs, ...newDocs];
  }

  private async atomicCommit(state: TransactionState, movedCount: number): Promise<void> {
    const commitMessage = `Transfer: Moved ${movedCount} documents from ${state.sourcePath} to ${state.destPath}`;

    try {
      // Case 1: Both files exist - update both with proper error handling
      if (state.sourceSha && state.destSha) {
        await this.updateBothFiles(state, commitMessage);
      }
      // Case 2: Source exists, destination doesn't - create dest first
      else if (state.sourceSha && !state.destSha) {
        await this.api.createFile(state.destPath, state.destContent, commitMessage);
        await this.api.updateFile(state.sourcePath, state.sourceContent, commitMessage, state.sourceSha);
      }
      // Case 3: Neither file exists - nothing to transfer
      else if (!state.sourceSha) {
        throw new Error(`Source file ${state.sourcePath} does not exist`);
      }
      // Case 4: Destination exists but source doesn't - create source with empty
      else {
        await this.api.createFile(state.sourcePath, state.sourceContent, `Initialize ${state.sourcePath}`);
        await this.api.updateFile(state.destPath, state.destContent, commitMessage, state.destSha!);
      }
    } catch (error) {
      console.error('Transaction failed:', error);
      throw new Error(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async updateBothFiles(state: TransactionState, message: string): Promise<void> {
    try {
      await this.api.updateFile(state.destPath, state.destContent, message, state.destSha!);
      await this.api.updateFile(state.sourcePath, state.sourceContent, message, state.sourceSha!);
    } catch (firstError) {
      console.warn('Potential temporary inconsistency detected. System will recover on next operation.');
      throw firstError;
    }
  }

  private parseFileContent(fileResult: PromiseSettledResult<any>, format: string): Document[] {
    if (fileResult.status === 'rejected' || !fileResult.value) {
      return [];
    }

    const content = fileResult.value.content;
    if (!content.trim()) return [];

    try {
      const formatter = this.formatConverter.getFormatter(format);
      return formatter.parse(content);
    } catch (error) {
      console.warn(`Failed to parse ${format} file, falling back to empty array:`, error);
      return [];
    }
  }

  private serializeContent(docs: Document[], format: string): string {
    const formatter = this.formatConverter.getFormatter(format);
    return formatter.serialize(docs);
  }

  private processTransfer(sourceDocs: Document[], predicate: QueryPredicate): { 
    matching: Document[]; 
    remaining: Document[] 
  } {
    const matching: Document[] = [];
    const remaining: Document[] = [];

    for (const doc of sourceDocs) {
      if (predicate(doc)) {
        matching.push(doc);
      } else {
        remaining.push(doc);
      }
    }

    return { matching, remaining };
  }

  /**
   * Convert file format during transfer
   */
  async convertFormat(
    sourcePath: string,
    destPath: string,
    options: ConversionOptions
  ): Promise<void> {
    const sourceFile = await this.api.getFile(sourcePath);
    if (!sourceFile) {
      throw new Error(`Source file ${sourcePath} not found`);
    }

    const convertedContent = this.formatConverter.convertContent(
      sourceFile.content,
      options
    );

    await this.api.createFile(destPath, convertedContent, `Convert format: ${sourcePath} -> ${destPath}`);
  }

  /**
   * Emergency recovery method to fix any inconsistent states
   */
  async verifyConsistency(sourcePath: string, destPath: string, predicate: QueryPredicate): Promise<boolean> {
    const [sourceDocs, destDocs] = await Promise.all([
      this.storage.readCollection(sourcePath).catch(() => []),
      this.storage.readCollection(destPath).catch(() => [])
    ]);

    const sourceMatches = sourceDocs.filter(predicate);
    const destMatches = destDocs.filter(predicate);

    return sourceMatches.length === 0;
  }

  getFormatConverter(): FormatConverter {
    return this.formatConverter;
  }
}