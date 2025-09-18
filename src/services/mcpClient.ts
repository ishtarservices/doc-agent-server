import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface MCPRequest {
  method: string;
  params?: any;
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MCPClient {
  private process: ChildProcess | null = null;
  private connected = false;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: MCPResponse) => void;
    reject: (error: Error) => void;
  }>();

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Start the MongoDB MCP server
      const configPath = path.join(__dirname, '../../mcp-config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const mongoConfig = config.mcpServers.mongodb;

      this.process = spawn('npx', mongoConfig.args, {
        env: {
          ...process.env,
          ...mongoConfig.env
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (this.process.stdout && this.process.stderr && this.process.stdin) {
        this.process.stdout.on('data', this.handleStdout.bind(this));
        this.process.stderr.on('data', this.handleStderr.bind(this));

        this.process.on('error', (error) => {
          console.error('MCP Process error:', error);
          this.connected = false;
        });

        this.process.on('exit', (code) => {
          console.log(`MCP Process exited with code: ${code}`);
          this.connected = false;
        });

        // Wait for connection
        await this.waitForConnection();
      }
    } catch (error) {
      console.error('Failed to initialize MCP client:', error);
    }
  }

  private handleStdout(data: Buffer): void {
    try {
      const messages = data.toString().split('\n').filter(line => line.trim());

      for (const message of messages) {
        const response: MCPResponse & { id?: number } = JSON.parse(message);

        if (response.id !== undefined) {
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error parsing MCP response:', error);
    }
  }

  private handleStderr(data: Buffer): void {
    console.error('MCP stderr:', data.toString());
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP connection timeout'));
      }, 10000);

      // Send a simple request to test connection
      this.sendRequest({ method: 'tools/list' })
        .then(() => {
          this.connected = true;
          clearTimeout(timeout);
          console.log('✅ MCP Client connected successfully');
          resolve();
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  public async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.process || !this.process.stdin || !this.connected) {
      throw new Error('MCP client not connected');
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: request.method,
        params: request.params || {}
      });

      this.pendingRequests.set(id, { resolve, reject });

      this.process!.stdin!.write(message + '\n');

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  public async query(collection: string, query: any = {}, options: any = {}): Promise<any[]> {
    try {
      const response = await this.sendRequest({
        method: 'tools/call',
        params: {
          name: 'mdb_find',
          arguments: {
            collection,
            query: JSON.stringify(query),
            ...options
          }
        }
      });

      return response.result?.content || [];
    } catch (error) {
      console.error(`MCP query error for collection ${collection}:`, error);
      throw error;
    }
  }

  public async insert(collection: string, documents: any[]): Promise<any> {
    try {
      const response = await this.sendRequest({
        method: 'tools/call',
        params: {
          name: 'mdb_insert',
          arguments: {
            collection,
            documents: JSON.stringify(documents)
          }
        }
      });

      return response.result;
    } catch (error) {
      console.error(`MCP insert error for collection ${collection}:`, error);
      throw error;
    }
  }

  public async update(collection: string, filter: any, update: any): Promise<any> {
    try {
      const response = await this.sendRequest({
        method: 'tools/call',
        params: {
          name: 'mdb_update',
          arguments: {
            collection,
            filter: JSON.stringify(filter),
            update: JSON.stringify(update)
          }
        }
      });

      return response.result;
    } catch (error) {
      console.error(`MCP update error for collection ${collection}:`, error);
      throw error;
    }
  }

  public async aggregate(collection: string, pipeline: any[]): Promise<any[]> {
    try {
      const response = await this.sendRequest({
        method: 'tools/call',
        params: {
          name: 'mdb_aggregate',
          arguments: {
            collection,
            pipeline: JSON.stringify(pipeline)
          }
        }
      });

      return response.result?.content || [];
    } catch (error) {
      console.error(`MCP aggregate error for collection ${collection}:`, error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.connected = false;
      this.pendingRequests.clear();
    }
  }
}

// Singleton instance
let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}