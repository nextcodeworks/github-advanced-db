import { Formatter, FormatOptions, Document } from './types';
import * as yaml from 'yaml';

export class YAMLFormatter implements Formatter {
  parse(content: string, options: FormatOptions = {}): Document[] {
    if (!content.trim()) return [];
    
    try {
      // First try to parse as a single document
      try {
        const singleDoc = yaml.parse(content);
        return Array.isArray(singleDoc) ? singleDoc : [singleDoc];
      } catch (e) {
        // If single document parse fails, try parsing as multiple documents
        const docs = yaml.parseAllDocuments(content);
        return docs.map(doc => {
          if (doc.errors && doc.errors.length > 0) {
            throw new Error(`YAML parsing error: ${doc.errors[0].message}`);
          }
          return doc.toJSON();
        });
      }
    } catch (error) {
      console.error('YAML parse error:', error);
      console.error('Content that failed to parse:', content);
      throw new Error(`Invalid YAML format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  serialize(documents: Document[], options: FormatOptions = {}): string {
    if (!documents || documents.length === 0) return '';
    
    try {
      // For single document, return as is
      if (documents.length === 1) {
        return yaml.stringify(documents[0], {
          indent: options.indent ?? 2
        }).trim();
      }
      
      // For multiple documents, join them with document separators
      return documents
        .map(doc => yaml.stringify(doc, { indent: options.indent ?? 2 }).trim())
        .join('\n---\n');
    } catch (error) {
      console.error('YAML serialize error:', error);
      console.error('Documents that failed to serialize:', documents);
      throw new Error(`Failed to serialize YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getFileExtension(): string {
    return 'yaml';
  }
}