# Doc Agent Board Server

A TypeScript Express.js server that provides API endpoints for the Doc Agent Board application, featuring AI-powered task management with Claude AI integration, dual database support (MongoDB + Supabase), and real-time collaboration features.

## 🏗️ Architecture Overview

This server acts as the backend for a modern task board application with the following key capabilities:

- **AI-Powered Task Management**: Integration with Claude AI for intelligent task creation and organization
- **Dual Database Architecture**: Primary MongoDB for core data + Supabase for authentication and real-time features
- **RESTful API**: Comprehensive endpoints for tasks, columns, and project management
- **MCP Integration**: Model Context Protocol support for MongoDB operations
- **Real-time Capabilities**: WebSocket support for live updates
- **Authentication**: Supabase-based JWT authentication with middleware protection

## 📁 Project Structure

```
server/
├── src/
│   ├── config/              # Database and service configurations
│   │   ├── mongodb.ts       # MongoDB connection and indexes
│   │   └── supabase.ts      # Supabase client setup
│   ├── controllers/         # Request handlers and business logic
│   │   └── aiController.ts  # AI request processing
│   ├── middleware/          # Express middleware
│   │   └── auth.ts          # Authentication middleware
│   ├── routes/             # API route definitions
│   │   ├── index.ts        # Main router
│   │   ├── ai.ts           # AI assistant endpoints
│   │   ├── tasks.ts        # Task CRUD operations
│   │   ├── columns.ts      # Column management
│   │   └── init.ts         # Database initialization
│   ├── services/           # Business logic and external integrations
│   │   ├── mongoService.ts # MongoDB operations
│   │   ├── taskService.ts  # Task-specific operations (Supabase)
│   │   ├── claudeService.ts# Claude AI integration
│   │   └── mcpClient.ts    # MCP protocol client
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # Shared interfaces
│   └── index.ts            # Server entry point
├── dist/                   # Compiled JavaScript output
├── mcp-config.json         # MCP server configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── .env.example           # Environment variables template
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas account or local MongoDB instance
- Supabase project
- Claude API key from Anthropic

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Environment Setup:**
   ```bash
   cp .env.example .env
   ```

   Configure your `.env` file with:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # Claude AI Configuration
   CLAUDE_API_KEY=your_claude_api_key_here
   CLAUDE_API_URL=https://api.anthropic.com/v1/messages

   # Supabase Configuration
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_service_role_key
   SUPABASE_ANON_KEY=your_anon_key

   # MongoDB Configuration (for MCP)
   MONGODB_URI=your_mongodb_connection_string
   MONGODB_DB_NAME=doc_agent_board

   # CORS Configuration
   ALLOWED_ORIGINS=http://localhost:8080,http://localhost:3000
   ```

3. **Start the server:**
   ```bash
   # Development mode with auto-reload
   npm run dev

   # Production build and start
   npm run build
   npm start
   ```

## 🛠️ Development Commands

```bash
# Development server with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Run tests
npm test
```

## 🔌 API Endpoints

### Health & Status
- `GET /` - Server status and endpoint information
- `GET /api/health` - Health check endpoint

### AI Assistant
- `POST /api/ai/assistant` - Process AI requests for task management
- `GET /api/ai/projects/:projectId/tasks` - Get project context for AI

### Task Management
- `POST /api/tasks` - Create a new task
- `PATCH /api/tasks/:taskId` - Update task properties
- `POST /api/tasks/:taskId/move` - Move task to different column/position
- `DELETE /api/tasks/:taskId` - Delete a task

### Column Management
- `POST /api/columns` - Create a new column
- `PATCH /api/columns/:columnId` - Update column properties
- `DELETE /api/columns/:columnId` - Delete column and all its tasks

### Initialization & Development
- `POST /api/init/default-project` - Initialize demo project with sample data
- `POST /api/init/reset` - Reset all project data
- `GET /api/init/debug` - Debug endpoint to inspect database contents

## 🤖 AI Integration

The server integrates with Claude AI to provide intelligent task management:

### Features
- **Natural Language Processing**: Convert user requests into structured tasks
- **Dynamic Column Creation**: AI can create custom columns based on project needs
- **Intelligent Task Organization**: Automatic categorization and estimation
- **Context-Aware Responses**: Uses current project state to make smart suggestions

### AI Request Format
```typescript
POST /api/ai/assistant
{
  "input": "Create marketing tasks for product launch",
  "projectId": "optional-project-id",
  "currentTasks": [], // Optional current tasks array
  "currentColumns": [] // Optional current columns array
}
```

### AI Response Types
1. **General Answer**: Informational responses
2. **Task Creation**: Creates new tasks and columns
3. **Task Management**: Organizes existing tasks

## 💾 Database Architecture

### Primary Database: MongoDB
- **Purpose**: Core application data storage
- **Collections**:
  - `projects` - Project metadata
  - `columns` - Board columns with configuration
  - `tasks` - Individual tasks with rich metadata
- **Features**:
  - Automatic indexing for performance
  - Flexible schema for dynamic task properties
  - Singleton connection pattern

### Secondary Database: Supabase
- **Purpose**: Authentication and legacy compatibility
- **Features**:
  - JWT-based authentication
  - Real-time subscriptions
  - Row Level Security (RLS)

### Data Models

#### Task Document
```typescript
interface TaskDocument {
  _id?: ObjectId;
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  type: 'email' | 'doc' | 'code' | 'research';
  status: 'backlog' | 'ready' | 'in_progress' | 'done';
  tokenEstimate?: number;
  assignedTool?: string;
  assignees?: Array<{
    id: string;
    name: string;
    avatar?: string;
    initials: string;
  }>;
  tags?: string[];
  position: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Column Document
```typescript
interface ColumnDocument {
  _id?: ObjectId;
  projectId: string;
  name: string;
  position: number;
  color?: string;
  config?: {
    isCollapsed?: boolean;
    isPinned?: boolean;
    visibility?: 'public' | 'private' | 'team';
  };
  createdAt: Date;
  updatedAt: Date;
}
```

## 🔐 Authentication & Security

### Authentication Flow
1. Frontend sends Supabase JWT token in `Authorization: Bearer <token>` header
2. `authenticateUser` middleware validates token with Supabase
3. User information attached to request object
4. Protected routes use `AuthenticatedRequest` interface

### Security Features
- **Helmet**: Security headers protection
- **CORS**: Configurable cross-origin request handling
- **Input Validation**: Zod schema validation for all inputs
- **Error Handling**: Comprehensive error middleware with sanitized responses
- **Environment Variables**: Secure configuration management

### Security Middleware
```typescript
// Authentication required for most endpoints
router.use(authenticateUser);

// Public endpoints (no auth required)
router.use('/init', initRoutes); // Development/demo endpoints
```

## 🔄 MCP (Model Context Protocol) Integration

The server includes MCP client for advanced MongoDB operations:

### Features
- **Connection Management**: Automatic connection handling with the MongoDB MCP server
- **Advanced Queries**: Support for complex aggregations and operations
- **Error Handling**: Robust error handling with timeouts and retries
- **Singleton Pattern**: Efficient resource management

### MCP Configuration
```json
{
  "mcpServers": {
    "mongodb": {
      "command": "npx",
      "args": ["-y", "@mongodb-js/mongodb-mcp-server@latest"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb://...",
        "MDB_MCP_DEFAULT_DB": "doc_agent_board"
      }
    }
  }
}
```

## 📊 Performance Features

### Database Optimization
- **Automatic Indexing**: Strategic indexes on frequently queried fields
- **Connection Pooling**: Efficient MongoDB connection management
- **Query Optimization**: Optimized queries for common operations

### Caching Strategy
- **Service Instances**: On-demand service instantiation to avoid initialization issues
- **Connection Reuse**: Singleton patterns for database connections
- **Memory Management**: Graceful shutdown handling

## 🚦 Error Handling

### Global Error Middleware
```typescript
// Comprehensive error handling with development/production modes
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});
```

### Service-Level Error Handling
- **Try-Catch Blocks**: Comprehensive error catching in all services
- **User-Friendly Messages**: Sanitized error messages for API responses
- **Logging**: Detailed error logging for debugging

## 🔧 Configuration

### TypeScript Configuration
- **Target**: ES2020 for modern JavaScript features
- **Module System**: CommonJS for Node.js compatibility
- **Strict Mode**: Full TypeScript strict checking enabled
- **Source Maps**: Enabled for debugging

### Express Configuration
- **Body Parsing**: JSON and URL-encoded with 10MB limit
- **Security**: Helmet for security headers
- **Logging**: Morgan for HTTP request logging
- **CORS**: Configurable origins for cross-domain requests

## 📈 Monitoring & Logging

### Request Logging
- **Morgan**: HTTP request logging in combined format
- **Error Logging**: Comprehensive error logging with stack traces
- **Environment-Specific**: Different log levels for development/production

### Health Monitoring
- **Health Check Endpoint**: `/api/health` for service monitoring
- **Database Status**: Connection status reporting
- **Service Dependencies**: MCP and external service status

## 🧪 Development & Testing

### Demo Data
The server includes initialization endpoints for development:

```bash
# Initialize demo project with sample data
POST /api/init/default-project

# Reset all data for fresh start
POST /api/init/reset

# Debug endpoint to inspect database contents
GET /api/init/debug
```

### Development Features
- **Auto-Reload**: tsx watch mode for development
- **TypeScript Support**: Full TypeScript compilation and type checking
- **ESLint**: Code quality and style checking
- **Environment Variables**: Development-specific configurations

## 🚀 Deployment

### Production Build
```bash
npm run build  # Compiles TypeScript to dist/ directory
npm start      # Runs compiled JavaScript
```

### Environment Variables
Ensure all production environment variables are set:
- Database connection strings
- API keys (Claude, Supabase)
- CORS origins for your frontend domain
- NODE_ENV=production

### Docker Support
The application is designed to be easily containerized:
- Uses standard Node.js runtime
- Configurable through environment variables
- Graceful shutdown handling for container environments

## 🤝 Contributing

1. Follow TypeScript strict mode requirements
2. Use existing patterns for services and controllers
3. Implement comprehensive error handling
4. Add appropriate types for all new interfaces
5. Test with the provided initialization endpoints

## 📝 License

MIT License - see package.json for details.

---

This server provides a robust foundation for AI-powered task management applications with modern architecture patterns, comprehensive error handling, and scalable database design.