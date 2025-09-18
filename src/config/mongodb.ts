import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'doc_agent_board';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

class MongoDB {
  private static instance: MongoDB;
  private client: MongoClient;
  private db: Db | null = null;

  private constructor() {
    this.client = new MongoClient(MONGODB_URI!);
  }

  public static getInstance(): MongoDB {
    if (!MongoDB.instance) {
      MongoDB.instance = new MongoDB();
    }
    return MongoDB.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(MONGODB_DB_NAME);
      console.log('✅ Connected to MongoDB successfully');

      // Create indexes for better performance
      await this.createIndexes();
    } catch (error) {
      console.error('🚨 MongoDB connection error:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.close();
      this.db = null;
      console.log('✅ Disconnected from MongoDB');
    } catch (error) {
      console.error('🚨 MongoDB disconnection error:', error);
      throw error;
    }
  }

  public getDb(): Db {
    if (!this.db) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.db;
  }

  public getClient(): MongoClient {
    return this.client;
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // Projects collection indexes
      await this.db.collection('projects').createIndex({ userId: 1 });
      await this.db.collection('projects').createIndex({ createdAt: -1 });

      // Columns collection indexes
      await this.db.collection('columns').createIndex({ projectId: 1, position: 1 });
      await this.db.collection('columns').createIndex({ projectId: 1, name: 1 }, { unique: true });

      // Tasks collection indexes
      await this.db.collection('tasks').createIndex({ projectId: 1, columnId: 1 });
      await this.db.collection('tasks').createIndex({ projectId: 1, position: 1 });
      await this.db.collection('tasks').createIndex({ createdBy: 1 });
      await this.db.collection('tasks').createIndex({ updatedAt: -1 });

      console.log('✅ MongoDB indexes created successfully');
    } catch (error) {
      console.error('🚨 Error creating MongoDB indexes:', error);
    }
  }
}

export default MongoDB;