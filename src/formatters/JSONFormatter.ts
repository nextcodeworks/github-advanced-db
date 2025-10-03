import { Formatter, FormatOptions, Document } from './types';

export class JSONFormatter implements Formatter {
  parse(content: string, options: FormatOptions = {}): Document[] {
    if (!content.trim()) return [];
    
    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  serialize(documents: Document[], options: FormatOptions = {}): string {
    const indent = options.indent ?? 2;
    const data = documents.length === 1 ? documents[0] : documents;
    
    return JSON.stringify(data, null, indent);
  }

  getFileExtension(): string {
    return 'json';
  }
}