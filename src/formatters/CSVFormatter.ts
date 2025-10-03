import { Formatter, FormatOptions, Document } from './types';

export class CSVFormatter implements Formatter {
  parse(content: string, options: FormatOptions = {}): Document[] {
    if (!content.trim()) return [];
    
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = this.parseCSVLine(lines[0]);
    
    return lines.slice(1).map((line, index) => {
      const values = this.parseCSVLine(line);
      const document: Document = {};
      
      headers.forEach((header, i) => {
        document[header] = values[i] || '';
      });
      
      return document;
    });
  }

  serialize(documents: Document[], options: FormatOptions = {}): string {
    if (documents.length === 0) return '';
    
    const headers = Array.from(
      new Set(documents.flatMap(doc => Object.keys(doc)))
    );
    
    const lines = [headers.map(header => this.escapeCSV(header)).join(',')];
    
    documents.forEach(doc => {
      const row = headers.map(header => 
        this.escapeCSV(doc[header]?.toString() || '')
      );
      lines.push(row.join(','));
    });
    
    return lines.join('\n') + '\n';
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result.map(field => field.trim());
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  getFileExtension(): string {
    return 'csv';
  }
}