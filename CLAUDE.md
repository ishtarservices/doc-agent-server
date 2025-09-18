# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server
npm start

# Run ESLint on TypeScript files
npm run lint

# Run tests (Jest framework)
npm test
```

## Architecture Overview

This is a TypeScript Express.js server for the Doc Agent Board application, featuring:

- **Complete Entity Management**: Organizations, Projects, Agents, Tasks, and Columns with full CRUD operations
- **AI Integration**: Claude AI integration via `/api/ai/assistant` endpoint for intelligent task management
- **Agent System**: AI agents that can be assigned to tasks and executed automatically
- **MongoDB Primary**: Core data storage with comprehensive document models
- **Supabase Authentication**: JWT-based authentication middleware
- **MCP Integration**: Model Context Protocol client for advanced MongoDB operations
- **RESTful API**: Full REST endpoints following frontend API expectations

## API Endpoint Structure

### Core Entities
- **Organizations**: `/api/organizations` - Manage organizations with settings, members, AI credits
- **Projects**: `/api/projects` - Project management within organizations
- **Agents**: `/api/agents` - AI agents that can execute tasks
- **Tasks**: `/api/tasks` - Individual work items with rich metadata
- **Columns**: `/api/columns` - Board columns with configuration and auto-run settings

### Key Endpoints
- `GET /api/health` - Server health check with full endpoint list
- `GET /api/projects/:projectId/context` - Full project context (org, project, tasks, columns, agents)
- `POST /api/ai/assistant` - Process AI requests with full context
- `POST /api/tasks/:taskId/assign-agent` - Assign AI agent to task
- `POST /api/tasks/:taskId/run-agent` - Execute assigned agent
- `GET /api/organizations/:organizationId/projects` - Get projects by organization
- `GET /api/organizations/:organizationId/agents` - Get agents by organization

## Key Components

### Controllers (MVC Pattern)
- `src/controllers/organizationController.ts` - Organization CRUD and AI usage tracking
- `src/controllers/projectController.ts` - Project management and context assembly
- `src/controllers/agentController.ts` - Agent management and execution
- `src/controllers/taskController.ts` - Task operations with agent integration
- `src/controllers/columnController.ts` - Column management with auto-run logic
- `src/controllers/aiController.ts` - AI request processing and entity creation

### Database Services
- `src/services/mongoService.ts` - Complete MongoDB operations for all entities
- `src/services/taskService.ts` - Legacy Supabase operations (minimal usage)
- `src/services/mcpClient.ts` - MCP protocol client for advanced queries
- `src/services/claudeService.ts` - Claude AI client integration

### Route Structure
- `src/routes/organizations.ts` - Organization routes + nested project/agent endpoints
- `src/routes/projects.ts` - Project routes + context endpoint
- `src/routes/agents.ts` - Agent CRUD operations
- `src/routes/tasks.ts` - Task CRUD + move/assign-agent/run-agent operations
- `src/routes/columns.ts` - Column CRUD + task listing
- `src/routes/ai.ts` - AI assistant processing
- `src/routes/init.ts` - Development/demo endpoints (no auth required)

### Data Models
Complete type system in `src/types/index.ts`:
- **Core Data Interfaces**: `OrganizationData`, `ProjectData`, `AgentData`, `TaskData`, `ColumnData`
- **MongoDB Documents**: `OrganizationDocument`, `ProjectDocument`, etc. with ObjectId fields
- **Request/Response Types**: `CreateTaskRequest`, `UpdateTaskRequest`, `ApiResponse<T>`, etc.
- **Special Types**: `ProjectContext` (full project data), `AIRequest`, `AIResponse`

### Agent System
- Agents have `type`, `model`, `systemPrompt`, and `capabilities`
- Tasks can be assigned agents via `assignedAgent` field and `agentHistory` tracking
- Columns support auto-run: when tasks move to column, assigned agent executes automatically
- Agent execution updates `actualTokensUsed`, `progressPercentage`, and `lastAgentRun`

## Environment Setup

Copy `.env.example` to `.env` and configure:
- `CLAUDE_API_KEY` - Anthropic Claude API key for AI processing
- `SUPABASE_URL` & `SUPABASE_SERVICE_KEY` - Supabase authentication
- `MONGODB_URI` - MongoDB Atlas connection string for primary data
- `ALLOWED_ORIGINS` - CORS configuration for frontend domains

## Database Collections

MongoDB collections with comprehensive schemas:
- `organizations` - Organization settings, members, AI credits
- `projects` - Projects with visibility, settings, members
- `agents` - AI agents with models, prompts, capabilities
- `tasks` - Rich task documents with agent history, dependencies, assignees
- `columns` - Board columns with auto-run settings and positioning

## Development Features

- Health endpoint lists all available API endpoints
- Init routes (`/api/init/*`) provide demo data and debugging
- Comprehensive error handling with proper HTTP status codes
- All routes use consistent `ApiResponse<T>` format
- TypeScript strict mode with complete type coverage

## Authentication Flow

1. Frontend sends Supabase JWT in `Authorization: Bearer <token>` header
2. `authenticateUser` middleware validates token and attaches user to request
3. Most routes require authentication except `/api/init/*` and `/api/health`
4. User information available as `req.user` in `AuthenticatedRequest`

## Agent Execution Flow

1. Agent assigned to task via `POST /api/tasks/:taskId/assign-agent`
2. Agent can be executed via `POST /api/tasks/:taskId/run-agent`
3. Column auto-run: moving task to column with `autoRun: true` triggers agent
4. Execution results stored in task's `agentHistory` with tokens used and output

## MCP Integration

Model Context Protocol enables advanced MongoDB operations through external MCP server configured in `mcp-config.json`. Used for complex queries and data analysis beyond basic CRUD operations.