import { Formatter, FormatOptions, ConversionOptions, Document } from './types';
import { JSONFormatter } from './JSONFormatter';
import { JSONLFormatter } from './JSONLFormatter';
import { CSVFormatter } from './CSVFormatter';
import { YAMLFormatter } from './YAMLFormatter';

export class FormatConverter {
  private formatters: Map<string, Formatter> = new Map();

  constructor() {
    this.registerFormatter('json', new JSONFormatter());
    this.registerFormatter('jsonl', new JSONLFormatter());
    this.registerFormatter('csv', new CSVFormatter());
    this.registerFormatter('yaml', new YAMLFormatter());
  }

  registerFormatter(format: string, formatter: Formatter): void {
    this.formatters.set(format, formatter);
  }

  getFormatter(format: string): Formatter {
    const formatter = this.formatters.get(format);
    if (!formatter) {
      throw new Error(`Unsupported format: ${format}`);
    }
    return formatter;
  }

  detectFormat(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'json': return 'json';
      case 'jsonl': return 'jsonl';
      case 'csv': return 'csv';
      case 'yaml':
      case 'yml': return 'yaml';
      default: return 'json'; // default fallback
    }
  }

  convertContent(
    content: string,
    options: ConversionOptions
  ): string {
    const sourceFormatter = this.getFormatter(options.sourceFormat);
    const targetFormatter = this.getFormatter(options.targetFormat);

    let documents = sourceFormatter.parse(content, options);
    
    // Apply transformations
    if (options.filter) {
      documents = documents.filter(options.filter);
    }
    
    if (options.transform) {
      documents = documents.map(options.transform);
    }
    
    if (options.fieldMapping) {
      documents = documents.map(doc => this.applyFieldMapping(doc, options.fieldMapping!));
    }
    
    if (options.timestampField) {
      documents = documents.map(doc => ({
        ...doc,
        [options.timestampField!]: new Date().toISOString()
      }));
    }

    return targetFormatter.serialize(documents, options);
  }

  convertDocuments(
    documents: Document[],
    options: ConversionOptions
  ): string {
    const targetFormatter = this.getFormatter(options.targetFormat);
    
    let processedDocs = [...documents];
    
    // Apply transformations
    if (options.filter) {
      processedDocs = processedDocs.filter(options.filter);
    }
    
    if (options.transform) {
      processedDocs = processedDocs.map(options.transform);
    }
    
    if (options.fieldMapping) {
      processedDocs = processedDocs.map(doc => this.applyFieldMapping(doc, options.fieldMapping!));
    }
    
    if (options.timestampField) {
      processedDocs = processedDocs.map(doc => ({
        ...doc,
        [options.timestampField!]: new Date().toISOString()
      }));
    }

    return targetFormatter.serialize(processedDocs, options);
  }

  private applyFieldMapping(doc: Document, fieldMapping: Record<string, string>): Document {
    const mapped: Document = {};
    
    Object.entries(fieldMapping).forEach(([newField, oldField]) => {
      if (oldField in doc) {
        mapped[newField] = doc[oldField];
      }
    });
    
    // Include unmapped fields
    Object.entries(doc).forEach(([key, value]) => {
      if (!Object.values(fieldMapping).includes(key)) {
        mapped[key] = value;
      }
    });
    
    return mapped;
  }

  getSupportedFormats(): string[] {
    return Array.from(this.formatters.keys());
  }
}