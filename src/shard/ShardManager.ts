import { GitHubDBConfig } from '../types';
import { GitHubAPIWrapper } from '../api/GitHubAPIWrapper';

export class ShardManager {
  /**
   * create a new shard manager instance
   * @param api - the GitHub API wrapper instance
   * @param config - the GitHubDB configuration
   */
  constructor(private api: GitHubAPIWrapper, private config: GitHubDBConfig) {}

  /**
   * get shard key for a given document
   */
  getShardKey(documentId: string): string {
    // simple sharding by first character of document id
    return documentId.charAt(0).toLowerCase();
  }

  /**
   * get all shard keys
   */
  getShardKeys(): string[] {
    // return array of possible shard keys (a-z, 0-9)
    return [
      ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i)), // a-z
      ...Array.from({ length: 10 }, (_, i) => i.toString()) // 0-9
    ];
  }

  /**
   * get shard path for a given shard key
   */
  getShardPath(shardKey: string): string {
    return `shards/${shardKey}.json`;
  }

  /**
   * check if shard exceeds max size and split if needed
   */
  async autoShardIfSizeExceeded(maxSizeBytes: number): Promise<void> {
    // implementation would check each shard's size and split if needed
    // this is a placeholder implementation
    console.log(`Checking shard sizes against max ${maxSizeBytes} bytes`);
    // actual implementation would:
    // 1. Get list of all shards
    // 2. Check size of each shard
    // 3. If any shard exceeds maxSizeBytes, split it into smaller shards
  }
}
