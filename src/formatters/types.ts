import { Document } from '../types';

export type { Document };

export interface FormatOptions {
  indent?: number;
  includeMetadata?: boolean;
  timestampField?: string;
  compression?: 'none' | 'gzip';
  
  // YAML-specific options
  yamlParseOptions?: {
    prettyErrors?: boolean;
    strict?: boolean;
    [key: string]: any;
  };
  
  yamlStringifyOptions?: {
    indent?: number;
    version?: string;
    [key: string]: any;
  };
}

export interface ConversionOptions extends FormatOptions {
  sourceFormat: 'json' | 'jsonl' | 'csv' | 'yaml';
  targetFormat: 'json' | 'jsonl' | 'csv' | 'yaml';
  fieldMapping?: Record<string, string>;
  filter?: (doc: Document) => boolean;
  transform?: (doc: Document) => Document;
}

export interface Formatter {
  parse(content: string, options?: FormatOptions): Document[];
  serialize(documents: Document[], options?: FormatOptions): string;
  getFileExtension(): string;
}