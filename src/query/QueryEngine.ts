import { Document, QueryPredicate } from '../types';

export class QueryEngine {
  filter(documents: Document[], predicate: QueryPredicate): Document[] {
    return documents.filter(predicate);
  }

  findOne(documents: Document[], predicate: QueryPredicate): Document | null {
    return documents.find(predicate) || null;
  }

  sort(documents: Document[], key: string, ascending: boolean = true): Document[] {
    return [...documents].sort((a, b) => {
      if (a[key] < b[key]) return ascending ? -1 : 1;
      if (a[key] > b[key]) return ascending ? 1 : -1;
      return 0;
    });
  }

  limit(documents: Document[], count: number): Document[] {
    return documents.slice(0, count);
  }
}