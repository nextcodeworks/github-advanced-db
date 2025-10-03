import axios, { AxiosInstance } from 'axios';
import { GitHubDBConfig } from '../types';

interface GitHubFile {
  path: string;
  content: string;
  sha?: string;
  type?: string;
}

interface GitHubContents {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size: number;
}

interface GitHubError {
  message: string;
  documentation_url?: string;
}

export class GitHubAPIWrapper {
  private client: AxiosInstance;
  private rateLimitRemaining: number = 5000;
  private rateLimitReset: number = 0;
  private owner: string;

  constructor(private config: GitHubDBConfig) {
    // Extract owner from repo if format is "owner/repo", otherwise use repo as both
    const [owner, repo] = config.repo.split('/');
    this.owner = owner;
    const repoName = repo || owner;
    
    this.client = axios.create({
      baseURL: `https://api.github.com/repos/${this.owner}/${repoName}`,
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      timeout: 30000
    });

    this.setupRateLimitMonitoring();
    this.setupErrorHandling();
  }

  private setupRateLimitMonitoring(): void {
    this.client.interceptors.response.use(
      (response) => {
        this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'] || '5000');
        this.rateLimitReset = parseInt(response.headers['x-ratelimit-reset'] || '0');
        return response;
      },
      (error) => {
        if (error.response?.status === 403 && this.rateLimitRemaining === 0) {
          const resetTime = new Date(this.rateLimitReset * 1000);
          throw new Error(`GitHub API rate limit exceeded. Resets at: ${resetTime.toISOString()}`);
        }
        return Promise.reject(error);
      }
    );
  }

  private setupErrorHandling(): void {
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.data) {
          const githubError = error.response.data as GitHubError;
          error.message = `GitHub API Error: ${githubError.message}`;
        }
        return Promise.reject(error);
      }
    );
  }

  async validateToken(): Promise<boolean> {
    try {
      const response = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      return response.status === 200;
    } catch (error) {
      throw new Error(`Invalid GitHub token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFile(path: string): Promise<GitHubFile | null> {
    try {
      const response = await this.client.get(`/contents/${encodeURIComponent(path)}`, {
        params: {
          ref: this.config.baseBranch || 'main'
        }
      });
      
      const content = response.data.content ? 
        Buffer.from(response.data.content, 'base64').toString('utf-8') : '';
      
      return {
        path: response.data.path,
        content,
        sha: response.data.sha,
        type: response.data.type
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to get file ${path}: ${error.message}`);
    }
  }

  async createFile(path: string, content: string, message: string): Promise<void> {
    try {
      const encodedContent = Buffer.from(content).toString('base64');
      
      await this.client.put(`/contents/${encodeURIComponent(path)}`, {
        message,
        content: encodedContent,
        branch: this.config.baseBranch || 'main'
      });
    } catch (error: any) {
      throw new Error(`Failed to create file ${path}: ${error.message}`);
    }
  }

  async updateFile(path: string, content: string, message: string, sha: string): Promise<void> {
    try {
      const encodedContent = Buffer.from(content).toString('base64');
      
      await this.client.put(`/contents/${encodeURIComponent(path)}`, {
        message,
        content: encodedContent,
        sha,
        branch: this.config.baseBranch || 'main'
      });
    } catch (error: any) {
      throw new Error(`Failed to update file ${path}: ${error.message}`);
    }
  }

  async deleteFile(path: string, message: string): Promise<void> {
    try {
      const file = await this.getFile(path);
      if (!file || !file.sha) {
        throw new Error(`File ${path} not found or missing SHA`);
      }

      await this.client.delete(`/contents/${encodeURIComponent(path)}`, {
        data: {
          message,
          sha: file.sha,
          branch: this.config.baseBranch || 'main'
        }
      });
    } catch (error: any) {
      throw new Error(`Failed to delete file ${path}: ${error.message}`);
    }
  }

  async getRepoContents(path: string = ''): Promise<GitHubContents[]> {
    try {
      const response = await this.client.get(`/contents/${encodeURIComponent(path)}`, {
        params: {
          ref: this.config.baseBranch || 'main'
        }
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw new Error(`Failed to get repo contents ${path}: ${error.message}`);
    }
  }

  async createDirectory(path: string): Promise<void> {
    try {
      // Create a .keep file to ensure the directory is created
      const keepFilePath = `${path}/.keep`;
      await this.createFile(keepFilePath, '', `Create directory: ${path}`);
    } catch (error: any) {
      throw new Error(`Failed to create directory ${path}: ${error.message}`);
    }
  }

  async repoExists(): Promise<boolean> {
    try {
      await this.client.get('');
      return true;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  getRateLimitStatus(): { remaining: number; reset: number } {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset
    };
  }
}