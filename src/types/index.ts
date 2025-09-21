// ============================================================================
// CORE ENTITY INTERFACES
// ============================================================================

export interface OrganizationData {
  _id: string; // MongoDB ObjectId
  name: string;
  slug: string; // URL-friendly identifier
  description?: string;
  logo?: string; // URL to organization logo
  settings: {
    defaultColumns: string[]; // Default column structure for new projects
    aiCredits: number; // Available AI credits
    maxProjects: number;
    features: string[]; // Enabled features
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

export interface ProjectData {
  _id: string; // MongoDB ObjectId
  organizationId: string; // Reference to organization
  name: string;
  description?: string;
  settings: {
    autoRunEnabled: boolean; // Global auto-run setting
    aiModel: string; // Default AI model for the project
    tokenBudget: number; // Token budget for AI operations
  };
  visibility: 'public' | 'private' | 'team';
  members: Array<{
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    addedAt: Date;
  }>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isArchived: boolean;
}

export interface AgentData {
  _id: string; // MongoDB ObjectId
  name: string;
  description: string;
  type: 'email' | 'doc' | 'code' | 'research' | 'design' | 'legal' | 'finance' | 'bug' | 'test' | 'infra' | 'outreach' | 'custom';
  logo?: string; // URL to agent logo/avatar
  model: string; // AI model to use (claude-3-5-sonnet, gpt-4, etc.)
  systemPrompt: string; // Instructions for the AI agent
  settings: {
    maxTokens: number;
    temperature: number;
    autoRun: boolean; // Whether this agent runs automatically
    retryAttempts: number;
    timeout: number; // Timeout in seconds
  };
  capabilities: string[]; // What this agent can do
  organizationId: string; // Reference to organization
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isPublic: boolean; // Whether other orgs can use this agent
}

export interface ColumnData {
  _id: string; // MongoDB ObjectId
  projectId: string; // Reference to project
  title: string;
  name: string; // Slug/identifier
  description?: string;
  color: string;
  position: number;
  settings: {
    isCollapsed: boolean;
    isPinned: boolean;
    autoRun: boolean; // Auto-run all tasks in this column
    autoRunAgent?: string; // Default agent for auto-run
    taskLimit?: number; // Max tasks allowed in column
  };
  visibility: 'public' | 'private' | 'team';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskData {
  _id: string; // MongoDB ObjectId
  projectId: string; // Reference to project
  columnId: string; // Reference to column
  title: string;
  description?: string;
  type: 'email' | 'doc' | 'code' | 'research' | 'design' | 'legal' | 'finance' | 'bug' | 'test' | 'infra' | 'outreach' | 'custom';
  status: 'backlog' | 'ready' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // AI Agent Assignment
  agents: Array<{
    agentId: string; // Reference to AgentData._id or external agent ID
    agentName: string; // Display name of the agent
  }>;
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

  // Estimation and Progress
  tokenEstimate: number;
  actualTokensUsed: number;
  progressPercentage: number; // 0-100

  // Assignment and Collaboration
  assignees: Array<{
    userId: string;
    name: string;
    email: string;
    avatar?: string;
    role: 'owner' | 'assignee' | 'reviewer';
    assignedAt: Date;
    initials: string;
  }>;

  // Organization and Metadata
  tags: string[];
  position: number;

  // Dependencies and Relationships
  dependencies: string[]; // Task IDs this task depends on
  blockedBy: string[]; // Task IDs blocking this task
  subtasks: string[]; // Subtask IDs
  parentTask?: string; // Parent task ID if this is a subtask

  // Timing
  dueDate?: Date;
  estimatedDuration?: number; // Hours
  timeSpent: number; // Actual hours spent

  // Lifecycle
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastAgentRun?: Date;
  completedAt?: Date;

  // UI State (not stored in DB)
  isUpdating?: boolean;
  isNew?: boolean;
  isSelected?: boolean;
}

// ============================================================================
// CONTEXT AND RESPONSE INTERFACES
// ============================================================================

// Extended column interface with tasks included
export interface ColumnWithTasks extends ColumnData {
  tasks: TaskData[];
}

export interface ProjectContext {
  organization: OrganizationData;
  project: ProjectData;
  tasks: TaskData[]; // Keep flat array for backward compatibility
  columns: ColumnWithTasks[]; // Enhanced columns with tasks
  agents: AgentData[];
  members: Array<{
    userId: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
  }>;
}


// ============================================================================
// API REQUEST/RESPONSE INTERFACES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    totalCount?: number;
    page?: number;
    limit?: number;
    tokensUsed?: number;
  };
}

// Organization Operations
export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  logo?: string;
  settings?: Partial<OrganizationData['settings']>;
}

// Project Operations
export interface CreateProjectRequest {
  organizationId: string;
  name: string;
  description?: string;
  visibility?: ProjectData['visibility'];
  settings?: Partial<ProjectData['settings']>;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  visibility?: ProjectData['visibility'];
  settings?: Partial<ProjectData['settings']>;
  isArchived?: boolean;
}

// Agent Operations
export interface CreateAgentRequest {
  organizationId: string;
  name: string;
  description: string;
  type: AgentData['type'];
  logo?: string;
  model: string;
  systemPrompt: string;
  settings?: Partial<AgentData['settings']>;
  capabilities?: string[];
  isPublic?: boolean;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  logo?: string;
  model?: string;
  systemPrompt?: string;
  settings?: Partial<AgentData['settings']>;
  capabilities?: string[];
  isActive?: boolean;
  isPublic?: boolean;
}

// Column Operations
export interface CreateColumnRequest {
  projectId: string;
  title: string;
  name: string;
  description?: string;
  color?: string;
  position?: number;
  settings?: Partial<ColumnData['settings']>;
  visibility?: ColumnData['visibility'];
}

export interface UpdateColumnRequest {
  title?: string;
  name?: string;
  description?: string;
  color?: string;
  position?: number;
  settings?: Partial<ColumnData['settings']>;
  visibility?: ColumnData['visibility'];
}

// Task Operations
export interface CreateTaskRequest {
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  type: TaskData['type'];
  status?: TaskData['status'];
  priority?: TaskData['priority'];
  tokenEstimate?: number;
  agents?: Array<{
    agentId: string;
    agentName: string;
  }>;
  assignees?: Array<{
    userId: string;
    role: 'owner' | 'assignee' | 'reviewer';
  }>;
  tags?: string[];
  dueDate?: Date;
  estimatedDuration?: number;
  dependencies?: string[];
  parentTask?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  type?: TaskData['type'];
  status?: TaskData['status'];
  priority?: TaskData['priority'];
  columnId?: string;
  tokenEstimate?: number;
  agents?: Array<{
    agentId: string;
    agentName: string;
  }>;
  agentHistory?: Array<{
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
  actualTokensUsed?: number;
  lastAgentRun?: Date;
  assignees?: Array<{
    userId: string;
    role: 'owner' | 'assignee' | 'reviewer';
  }>;
  tags?: string[];
  position?: number;
  dueDate?: Date;
  estimatedDuration?: number;
  timeSpent?: number;
  progressPercentage?: number;
  dependencies?: string[];
  blockedBy?: string[];
}

export interface MoveTaskRequest {
  columnId: string;
  position?: number;
}

export interface AssignAgentRequest {
  taskId: string;
  agents: Array<{
    agentId: string;
    agentName: string;
  }>;
  autoRun?: boolean;
}

export interface RunAgentRequest {
  taskId: string;
  agentId?: string; // If not provided, uses default inference agent
  options?: {
    maxTokens?: number;
    temperature?: number;
  };
}

// ============================================================================
// DATABASE DOCUMENT INTERFACES (MongoDB)
// ============================================================================

export interface TaskDocument {
  _id?: import('mongodb').ObjectId;
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  type: 'email' | 'doc' | 'code' | 'research' | 'design' | 'legal' | 'finance' | 'bug' | 'test' | 'infra' | 'outreach' | 'custom';
  status: 'backlog' | 'ready' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  agents?: Array<{
    agentId: string;
    agentName: string;
  }>;
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
  tokenEstimate: number;
  actualTokensUsed: number;
  progressPercentage: number;
  assignees: Array<{
    userId: string;
    name: string;
    email: string;
    avatar?: string;
    role: 'owner' | 'assignee' | 'reviewer';
    assignedAt: Date;
    initials: string;
  }>;
  tags: string[];
  position: number;
  dependencies: string[];
  blockedBy: string[];
  subtasks: string[];
  parentTask?: string;
  dueDate?: Date;
  estimatedDuration?: number;
  timeSpent: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastAgentRun?: Date;
  completedAt?: Date;
}

export interface ColumnDocument {
  _id?: import('mongodb').ObjectId;
  projectId: string;
  title: string;
  name: string;
  description?: string;
  color: string;
  position: number;
  settings: {
    isCollapsed: boolean;
    isPinned: boolean;
    autoRun: boolean;
    autoRunAgent?: string;
    taskLimit?: number;
  };
  visibility: 'public' | 'private' | 'team';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDocument {
  _id?: import('mongodb').ObjectId;
  organizationId: string;
  name: string;
  description?: string;
  settings: {
    autoRunEnabled: boolean;
    aiModel: string;
    tokenBudget: number;
  };
  visibility: 'public' | 'private' | 'team';
  members: Array<{
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    addedAt: Date;
  }>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isArchived: boolean;
}

export interface OrganizationDocument {
  _id?: import('mongodb').ObjectId;
  name: string;
  slug: string;
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

export interface AgentDocument {
  _id?: import('mongodb').ObjectId;
  name: string;
  description: string;
  type: 'email' | 'doc' | 'code' | 'research' | 'design' | 'legal' | 'finance' | 'bug' | 'test' | 'infra' | 'outreach' | 'custom';
  logo?: string;
  model: string;
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
  isPublic: boolean;
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

// Legacy interfaces for backward compatibility with existing code
export interface DatabaseTask {
  id: string;
  title: string;
  description: string | null;
  type: 'email' | 'doc' | 'code' | 'research';
  status: 'backlog' | 'ready' | 'in_progress' | 'done';
  token_estimate: number | null;
  project_id: string;
  created_by: string;
  position: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeAPIResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
  id: string;
  model: string;
  role: string;
  stop_reason: string;
  stop_sequence: null;
  type: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type EntityStatus = 'active' | 'inactive' | 'archived' | 'deleted';
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';
export type TaskStatus = TaskData['status'];
export type TaskType = TaskData['type'];
export type TaskPriority = TaskData['priority'];
export type ColumnVisibility = ColumnData['visibility'];
export type AIModelType = 'claude-3-5-sonnet' | 'claude-3-haiku' | 'gpt-4' | 'gpt-3.5-turbo';

// Query and Filter Types
export interface TaskFilters {
  status?: TaskStatus[];
  type?: TaskType[];
  priority?: TaskPriority[];
  assignedAgent?: string[];
  assignees?: string[];
  tags?: string[];
  dueDate?: {
    from?: Date;
    to?: Date;
  };
  createdAt?: {
    from?: Date;
    to?: Date;
  };
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Available Agent Types
export interface AvailableAgent {
  agentId: string;
  agentName: string;
  description?: string;
  type: 'local' | 'remote';
  capabilities?: string[];
}

export interface AvailableAgentsResponse {
  success: boolean;
  data: AvailableAgent[];
}

// Agent Execution Response Types
export interface AgentExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  tokensUsed: number;
  executionTime: number;
  status: 'completed' | 'failed' | 'in_progress';
  followUp?: {
    suggestions: string[];
    nextActions: string[];
  };
  artifacts?: {
    type: 'git_patch' | 'code' | 'analysis' | 'documentation' | 'test_results' | 'file_diff';
    title: string;
    content: string;
    metadata?: {
      repository?: string;
      branch?: string;
      filesChanged?: number;
      linesAdded?: number;
      linesRemoved?: number;
      language?: string;
    };
  }[];
}

export interface CoralServerPayload {
  query: string;
  context?: {
    taskId: string;
    taskTitle: string;
    taskDescription?: string;
    projectContext?: any;
  };
}