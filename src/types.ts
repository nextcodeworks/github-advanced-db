export interface GitHubDBConfig {
    token: string;
    repo: string;
    owner?: string;
    mode: 'document' | 'collection';
    cache?: boolean;
    batchSize?: number;
    format?: 'json' | 'jsonl';
    baseBranch?: string;
  }
  
  export type StorageMode = 'document' | 'collection';
  export type FileFormat = 'json' | 'jsonl';
  
  export interface OperationOptions {
    hashFields?: string[];
    unhashFields?: string[];
    format?: FileFormat;
  }
  
  export interface Document {
    [key: string]: any;
  }
  
  export interface QueryPredicate {
    (doc: Document): boolean;
  }
  
  export interface Index {
    [key: string]: any;
  }
  
  export interface CacheItem {
    key: string;
    data: any;
    timestamp: number;
  }