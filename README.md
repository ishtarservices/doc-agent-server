# Doc Agent Board Server

A TypeScript Express.js server that provides API endpoints for the Doc Agent Board application, featuring AI-powered task management with Claude AI integration, dual database support (MongoDB + Supabase), and real-time collaboration features.

## 🏗️ Architecture Overview

This server acts as the backend for a modern task board application with the following key capabilities:

- **Complete Entity Management**: Organizations, Projects, Agents, Tasks, and Columns with full CRUD operations
- **AI-Powered Task Management**: Integration with Claude AI for intelligent task creation and agent execution
- **MongoDB Primary**: Core data storage with comprehensive document models and efficient queries
- **Supabase Authentication**: JWT-based authentication with comprehensive user management
- **RESTful API**: Full REST endpoints with consistent ApiResponse format and error handling
- **MCP Integration**: Model Context Protocol support for advanced MongoDB operations
- **Advanced Authorization**: Multi-level access control (organization → project → resource)
- **Structured Logging**: Comprehensive request tracking, performance monitoring, and debugging
- **Security Features**: Helmet, CORS, input validation, and role-based access control

## 📁 Project Structure

```
server/
├── src/
│   ├── config/              # Database and service configurations
│   │   ├── mongodb.ts       # MongoDB connection and indexes
│   │   └── supabase.ts      # Supabase client setup
│   ├── controllers/         # Request handlers and business logic (MVC pattern)
│   │   ├── aiController.ts          # AI request processing and entity creation
│   │   ├── organizationController.ts # Organization CRUD and AI usage tracking
│   │   ├── projectController.ts     # Project management and context assembly
│   │   ├── agentController.ts       # Agent management and execution
│   │   ├── taskController.ts        # Task operations with agent integration
│   │   └── columnController.ts      # Column management with auto-run logic
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts              # Supabase JWT authentication middleware
│   │   ├── authorization.ts     # Multi-level authorization (org/project/resource)
│   │   └── requestLogger.ts     # Comprehensive request/response logging
│   ├── routes/             # API route definitions
│   │   ├── index.ts            # Main router with health check and endpoint listing
│   │   ├── ai.ts               # AI assistant processing
│   │   ├── organizations.ts    # Organization routes + nested project/agent endpoints
│   │   ├── projects.ts         # Project routes + context endpoint
│   │   ├── agents.ts           # Agent CRUD operations
│   │   ├── tasks.ts            # Task CRUD + move/assign-agent/run-agent operations
│   │   ├── columns.ts          # Column CRUD + task listing
│   │   └── init.ts             # Development/demo endpoints (no auth required)
│   ├── services/           # Business logic and external integrations
│   │   ├── mongoService.ts     # Complete MongoDB operations for all entities (884 lines)
│   │   ├── taskService.ts      # Legacy Supabase operations (minimal usage)
│   │   ├── claudeService.ts    # Claude AI integration
│   │   └── mcpClient.ts        # MCP protocol client for advanced queries
│   ├── utils/              # Utility functions and helpers
│   │   ├── logger.ts           # Structured logging with multiple log levels
│   │   └── authorization.ts    # Authorization utility functions and access checks
│   ├── types/              # TypeScript type definitions (627 lines)
│   │   └── index.ts            # Complete type system for all entities
│   └── index.ts            # Server entry point with graceful shutdown
├── dist/                   # Compiled JavaScript output
├── mcp-config.json         # MCP server configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── CLAUDE.md               # Claude Code guidance and architecture documentation
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
- `GET /api/health` - Health check with full endpoint list

### User & Organizations
- `GET /api/user/organizations` - Get organizations accessible to current user
- `POST /api/organizations` - Create a new organization
- `GET /api/organizations/:organizationId` - Get organization details
- `PATCH /api/organizations/:organizationId` - Update organization
- `DELETE /api/organizations/:organizationId` - Delete organization
- `GET /api/organizations/:organizationId/ai-usage` - Get AI usage statistics
- `GET /api/organizations/:organizationId/projects` - Get projects by organization
- `GET /api/organizations/:organizationId/agents` - Get agents by organization

### Projects
- `POST /api/projects` - Create a new project
- `GET /api/projects/:projectId` - Get project details
- `PATCH /api/projects/:projectId` - Update project
- `DELETE /api/projects/:projectId` - Delete project
- `GET /api/projects/:projectId/context` - Full project context (org, project, tasks, columns, agents)
- `GET /api/projects/:projectId/tasks` - Get tasks by project
- `GET /api/projects/:projectId/columns` - Get columns by project

### AI Agents
- `POST /api/agents` - Create a new AI agent
- `GET /api/agents/:agentId` - Get agent details
- `PATCH /api/agents/:agentId` - Update agent
- `DELETE /api/agents/:agentId` - Delete agent

### AI Assistant
- `POST /api/ai/assistant` - Process AI requests with full context

### Task Management
- `POST /api/tasks` - Create a new task
- `GET /api/tasks/:taskId` - Get task details
- `PATCH /api/tasks/:taskId` - Update task properties
- `DELETE /api/tasks/:taskId` - Delete a task
- `POST /api/tasks/:taskId/move` - Move task to different column/position
- `POST /api/tasks/:taskId/assign-agent` - Assign AI agent to task
- `POST /api/tasks/:taskId/run-agent` - Execute assigned agent

### Column Management
- `POST /api/columns` - Create a new column
- `GET /api/columns/:columnId` - Get column details
- `PATCH /api/columns/:columnId` - Update column properties
- `DELETE /api/columns/:columnId` - Delete column and all its tasks
- `GET /api/columns/:columnId/tasks` - Get tasks in specific column

### Development & Debugging
- `POST /api/init/default-project` - Initialize demo project with sample data
- `POST /api/init/reset` - Reset all project data
- `GET /api/init/debug` - Debug endpoint to inspect database contents

## 🤖 AI Integration

The server integrates with Claude AI to provide intelligent task management and agent execution:

### AI Assistant Features
- **Natural Language Processing**: Convert user requests into structured tasks and actions
- **Dynamic Entity Creation**: AI can create tasks, columns, and agents based on project needs
- **Intelligent Organization**: Automatic categorization, estimation, and task organization
- **Context-Aware Responses**: Uses full project context (org, tasks, columns, agents) for smart suggestions
- **Multi-Entity Management**: Handles complex requests spanning multiple entities

### Agent System
- **Agent Types**: email, doc, code, research, design, legal, finance, bug, test, infra, outreach, custom
- **Agent Execution**: Tasks can be assigned agents that execute automatically or on-demand
- **Execution History**: Full tracking of agent runs with token usage and results
- **Auto-Run Columns**: Moving tasks to columns with `autoRun: true` triggers assigned agents
- **Agent Settings**: Configurable models, temperature, max tokens, retry attempts, timeout

### AI Request Format
```typescript
POST /api/ai/assistant
{
  "input": "Create marketing tasks for product launch and assign agents",
  "projectId": "required-project-id",
  "organizationId": "required-organization-id",
  "agentId": "optional-specific-agent-id",
  "context": {
    "currentTasks": [],      // Current project tasks
    "currentColumns": [],    // Current project columns
    "availableAgents": []    // Available agents in organization
  },
  "options": {
    "autoAssignAgent": true, // Whether to auto-assign agents to created tasks
    "createInColumn": "columnId", // Specific column for new tasks
    "maxTokens": 4000       // Token limit for AI processing
  }
}
```

### AI Response Types
1. **General Answer**: Informational responses and guidance
2. **Task Creation**: Creates new tasks with agent assignments
3. **Task Management**: Organizes, updates, and manages existing tasks
4. **Agent Assignment**: Assigns appropriate agents to tasks based on type and requirements
5. **Error Handling**: Detailed error responses with troubleshooting guidance

## 💾 Database Architecture

### Primary Database: MongoDB
- **Purpose**: Core application data storage with comprehensive document models
- **Collections**:
  - `organizations` - Organization settings, members, AI credits (with member roles and permissions)
  - `projects` - Project metadata with visibility controls and member management
  - `agents` - AI agents with models, prompts, capabilities, and execution settings
  - `tasks` - Rich task documents with agent history, dependencies, assignees, progress tracking
  - `columns` - Board columns with auto-run settings, positioning, and visibility controls
- **Features**:
  - Automatic indexing for performance optimization
  - ObjectId-based relationships between entities
  - Flexible schema supporting dynamic properties
  - Singleton connection pattern with graceful shutdown
  - Comprehensive access control and authorization

### Secondary Database: Supabase
- **Purpose**: Authentication and user management
- **Features**:
  - JWT-based authentication with token validation
  - User profiles and session management
  - Real-time subscriptions (legacy support)
  - Row Level Security (RLS) policies

### Data Models

#### Task Document (Complete Entity)
```typescript
interface TaskDocument {
  _id?: ObjectId;
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  type: 'email' | 'doc' | 'code' | 'research' | 'design' | 'legal' | 'finance' | 'bug' | 'test' | 'infra' | 'outreach' | 'custom';
  status: 'backlog' | 'ready' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // AI Agent Integration
  assignedAgent?: string;
  agentHistory: Array<{
    agentId: string;
    assignedAt: Date;
    assignedBy: string;
    result?: {
      success: boolean;
      output?: string;
      tokensUsed: number;
      executedAt: Date;
      error?: string;
    };
  }>;

  // Progress Tracking
  tokenEstimate: number;
  actualTokensUsed: number;
  progressPercentage: number;

  // Collaboration
  assignees: Array<{
    userId: string;
    name: string;
    email: string;
    avatar?: string;
    role: 'owner' | 'assignee' | 'reviewer';
    assignedAt: Date;
    initials: string;
  }>;

  // Organization & Dependencies
  tags: string[];
  position: number;
  dependencies: string[];
  blockedBy: string[];
  subtasks: string[];
  parentTask?: string;

  // Timing
  dueDate?: Date;
  estimatedDuration?: number;
  timeSpent: number;

  // Lifecycle
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastAgentRun?: Date;
  completedAt?: Date;
}
```

#### Agent Document
```typescript
interface AgentDocument {
  _id?: ObjectId;
  name: string;
  description: string;
  type: 'email' | 'doc' | 'code' | 'research' | 'design' | 'legal' | 'finance' | 'bug' | 'test' | 'infra' | 'outreach' | 'custom';
  logo?: string;
  model: string; // AI model (claude-3-5-sonnet, gpt-4, etc.)
  systemPrompt: string;
  settings: {
    maxTokens: number;
    temperature: number;
    autoRun: boolean;
    retryAttempts: number;
    timeout: number;
  };
  capabilities: string[];
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isPublic: boolean; // Whether other orgs can use this agent
}
```

#### Organization Document
```typescript
interface OrganizationDocument {
  _id?: ObjectId;
  name: string;
  slug: string; // URL-friendly identifier
  description?: string;
  logo?: string;
  settings: {
    defaultColumns: string[];
    aiCredits: number;
    maxProjects: number;
    features: string[];
  };
  members: Array<{
    userId: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    joinedAt: Date;
    permissions: string[];
  }>;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}
```

## 🔐 Authentication & Security

### Authentication Flow (src/middleware/auth.ts)
1. Frontend sends Supabase JWT token in `Authorization: Bearer <token>` header
2. `authenticateUser` middleware validates token with Supabase and attaches user to request
3. User information available as `req.user` in `AuthenticatedRequest`
4. All authentication events logged with structured logging

### Authorization Flow (src/middleware/authorization.ts)
1. **Organization Level**: `requireOrganizationAccess()` - Validates user membership and role permissions
2. **Project Level**: `requireProjectAccess()` - Checks organization access + project-specific permissions
3. **Resource Level**: `requireTaskAccess()`, `requireColumnAccess()`, `requireAgentAccess()`
4. **Role Hierarchy**: viewer < member < editor < admin < owner (with hierarchical permissions)
5. **Visibility Controls**: public (all org members), team (explicit members), private (creators + members)
6. **Context Enrichment**: Attaches organization, project, and resource objects to request

### Authorization Utilities (src/utils/authorization.ts)
- **Access Checks**: `hasOrganizationAccess()`, `hasProjectAccess()`, `hasTaskAccess()`, etc.
- **Role Validation**: `canPerformAction()`, `hasMinimumRole()` with role hierarchy
- **User Queries**: `getUserOrganizations()`, `getUserProjectsInOrganization()`
- **Security**: All operations include comprehensive error handling and logging

### Security Features
- **Helmet**: Security headers protection (XSS, clickjacking, etc.)
- **CORS**: Configurable cross-origin request handling with environment-based origins
- **Input Validation**: Comprehensive request validation with MongoDB ObjectId checks
- **Error Handling**: Global error middleware with development/production mode differences
- **Rate Limiting**: Built-in protection via proper middleware stacking
- **Logging**: All security events logged with context (auth, authz, errors)
- **Token Management**: Secure JWT handling with proper validation and error responses

### Security Middleware Stack
```typescript
// Global security
app.use(helmet());
app.use(cors(corsOptions));

// Request logging and authentication
app.use(logAllRequests);
app.use(authenticateUser); // Most routes require auth

// Authorization (per-route)
router.use('/organizations/:organizationId/*', requireOrganizationAccess());
router.use('/projects/:projectId/*', requireProjectAccess());
router.use('/tasks/:taskId/*', requireTaskAccess());

// Public endpoints (no auth required)
router.use('/init', initRoutes); // Development/demo only
router.get('/health', healthCheck); // Service monitoring
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

## 📊 Logging & Monitoring

### Structured Logging System (src/utils/logger.ts)
- **Request Tracking**: Unique request IDs for tracing requests across middleware and services
- **Contextual Logging**: Automatic inclusion of user ID, IP, method, URL, timestamps
- **Multiple Log Levels**: INFO (📝), WARN (⚠️), ERROR (🚨), AUTH (🔐), AUTHZ (🛡️), API (🌐), DB (💾)
- **JSON Format**: Structured logging for easy parsing, searching, and analysis
- **Error Details**: Complete stack traces and error metadata for debugging

### Request Logging (src/middleware/requestLogger.ts)
- **Full Lifecycle**: Logs incoming requests and outgoing responses with timing
- **Performance Monitoring**: Request duration measurement and response analysis
- **Security Logging**: Authorization headers (truncated), IP tracking, user agent analysis
- **Body Analysis**: Request/response body inspection with size tracking
- **Status Tracking**: Success/failure detection with appropriate log levels

### Log Categories
```typescript
Logger.info('General information', req, data);     // 📝 General operations
Logger.warn('Warning condition', req, data);       // ⚠️ Warning conditions
Logger.error('Error occurred', req, error, data);  // 🚨 Errors with stack traces
Logger.auth('Authentication event', req, data);    // 🔐 Auth-related events
Logger.authz('Authorization check', req, data);    // 🛡️ Permission checks
Logger.api('API operation', req, res, data);       // 🌐 API request/response
Logger.db('Database operation', req, data);        // 💾 Database operations
```

## 📊 Performance Features

### Database Optimization
- **Automatic Indexing**: Strategic indexes on frequently queried fields (_id, projectId, organizationId, etc.)
- **Connection Pooling**: Efficient MongoDB connection management with singleton pattern
- **Query Optimization**: Optimized queries for common operations (project context, user organizations)
- **Document Validation**: MongoDB ObjectId validation prevents invalid query attempts

### Caching Strategy
- **Service Instances**: On-demand service instantiation to avoid initialization timing issues
- **Connection Reuse**: Singleton patterns for database connections with graceful shutdown
- **Memory Management**: Proper cleanup of connections, request contexts, and middleware state

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