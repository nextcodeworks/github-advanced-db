import { Formatter, FormatOptions, Document } from './types';

export class JSONLFormatter implements Formatter {
  parse(content: string, options: FormatOptions = {}): Document[] {
    if (!content.trim()) return [];
    
    return content
      .split('\n')
      .filter(line => line.trim())
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch (error) {
          throw new Error(`Invalid JSONL at line ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });
  }

  serialize(documents: Document[], options: FormatOptions = {}): string {
    return documents
      .map(doc => JSON.stringify(doc))
      .join('\n') + (documents.length > 0 ? '\n' : '');
  }

  getFileExtension(): string {
    return 'jsonl';
  }
}