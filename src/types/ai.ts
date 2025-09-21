// types/ai.ts - Backend AI Types for Doc Agent Board

import type {
  TaskData,
  ColumnData,
  AgentData,
  ProjectData,
  OrganizationData,
  TaskDocument,
  ColumnDocument,
  AgentDocument,
  ProjectDocument,
  OrganizationDocument
} from './index';

// ============================================================================
// ENHANCED AI REQUEST/RESPONSE INTERFACES
// ============================================================================

export interface AIAttachment {
  type: 'image' | 'document' | 'file';
  url: string;
  name: string;
  size: number;
  mimeType: string;
  content?: string; // Base64 encoded content for processing
}

export interface AIMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: AIAttachment[];
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
    createdTasks?: number;
    updatedTasks?: number;
  };
}

export interface AIConversationContext {
  conversationId: string;
  messages: AIMessage[];
  projectId: string;
  organizationId: string;
  userId: string;
}

export interface AIRequest {
  // Core request data
  input: string;
  userId: string; // Added user ID for authorization and personalization
  projectId: string;
  organizationId: string;
  
  // Optional parameters
  agentId?: string; // Specific agent to use
  conversationId?: string; // For maintaining conversation context
  attachments?: AIAttachment[]; // Support for images and documents
  
  // Current project context
  context: {
    currentTasks: TaskData[];
    currentColumns: ColumnData[];
    availableAgents: AgentData[];
    project: ProjectData;
    organization: OrganizationData;
  };
  
  // AI processing options
  options?: {
    autoAssignAgent?: boolean;
    createInColumn?: string;
    maxTokens?: number;
    temperature?: number;
    enableTools?: boolean; // Whether to enable database modification tools
    responseFormat?: 'text' | 'structured'; // For structured responses
    priority?: 'low' | 'normal' | 'high'; // Processing priority
  };
}

export interface AIResponse {
  // Core response data
  type: 'general_answer' | 'task_creation' | 'task_management' | 'agent_assignment' | 'project_management' | 'error' | 'tool_execution';
  message: string;
  conversationId?: string;
  
  // Creation Results
  createdTasks?: TaskData[];
  createdColumns?: ColumnData[];
  createdAgents?: AgentData[];
  createdProjects?: ProjectData[];
  
  // Modification Results
  updatedTasks?: TaskData[];
  updatedColumns?: ColumnData[];
  updatedProjects?: ProjectData[];
  deletedItems?: Array<{
    type: 'task' | 'column' | 'agent';
    id: string;
    name: string;
  }>;
  
  // Agent Execution Results
  agentResults?: Array<{
    taskId: string;
    agentId: string;
    success: boolean;
    output?: string;
    tokensUsed: number;
    error?: string;
  }>;
  
  // Tool execution results
  toolResults?: Array<{
    tool: string;
    success: boolean;
    result?: any;
    error?: string;
  }>;
  
  // Metadata
  tokensUsed: number;
  executionTime: number;
  suggestions?: string[];
  confidence?: number; // AI confidence in the response (0-1)
  requiresConfirmation?: boolean; // Whether the action needs user confirmation
  
  // Follow-up actions
  followUpActions?: Array<{
    type: 'create_task' | 'assign_agent' | 'move_task' | 'update_project';
    description: string;
    data: any;
  }>;
}

// ============================================================================
// AI TOOL SYSTEM TYPES
// ============================================================================

export interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  execute: (params: any, context: AIToolContext) => Promise<any>;
}

export interface AIToolContext {
  userId: string;
  projectId: string;
  organizationId: string;
  mongoService: any; // MongoService instance
}

export interface AIToolResult {
  success: boolean;
  data?: any;
  error?: string;
  tokensUsed?: number;
}

// ============================================================================
// INTENT DETECTION TYPES
// ============================================================================

export interface AIIntent {
  primary: 'general_answer' | 'task_creation' | 'task_management' | 'agent_assignment' | 'project_management' | 'agent_use' | 'other' | 'error';
  secondary?: string; // More specific intent like 'create_task', 'analyze_progress'
  confidence: number;
  entities: Array<{
    type: 'task' | 'column' | 'agent' | 'project' | 'user' | 'date' | 'priority' | 'status';
    value: string;
    confidence: number;
  }>;
}

export interface AIIntentAnalysis {
  intent: AIIntent;
}

// ============================================================================
// CLAUDE SERVICE TYPES
// ============================================================================

export interface ClaudeToolCall {
  name: string;
  parameters: any;
}

export interface ClaudeResponse {
  message: string;
  tokensUsed: number;
  toolCalls?: ClaudeToolCall[];
  suggestions?: string[];
}

export interface ClaudeServiceOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: AITool[];
}

// ============================================================================
// OPENAI SERVICE TYPES
// ============================================================================

export interface OpenAIToolCall {
  name: string;
  parameters: any;
}

export interface OpenAIResponse {
  message: string;
  tokensUsed: number;
  toolCalls?: OpenAIToolCall[];
  suggestions?: string[];
}

export interface OpenAIServiceOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: AITool[];
}

// ============================================================================
// MCP INTEGRATION TYPES
// ============================================================================

export interface MongoDBOperation {
  operation: 'find' | 'insertOne' | 'insertMany' | 'updateOne' | 'updateMany' | 'deleteOne' | 'deleteMany' | 'aggregate';
  collection: string;
  query?: any;
  data?: any;
  options?: any;
}

export interface MCPToolRequest {
  tool: string;
  parameters: Record<string, any>;
}

export interface MCPToolResponse {
  success: boolean;
  result?: any;
  error?: string;
}

// ============================================================================
// AI ANALYTICS AND MONITORING
// ============================================================================

export interface AIUsageMetrics {
  userId: string;
  organizationId: string;
  projectId?: string;
  timestamp: Date;
  tokensUsed: number;
  executionTime: number;
  requestType: AIResponse['type'];
  success: boolean;
  toolsUsed: string[];
}

export interface AIPerformanceMetrics {
  averageResponseTime: number;
  totalTokensUsed: number;
  successRate: number;
  mostUsedTools: Array<{
    tool: string;
    usage: number;
  }>;
  errorRate: number;
  userSatisfactionScore?: number;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export interface AIRequestValidation {
  input: {
    minLength: number;
    maxLength: number;
    allowedTypes: string[];
  };
  attachments: {
    maxCount: number;
    maxSize: number; // in bytes
    allowedTypes: string[];
  };
  context: {
    requiredFields: string[];
  };
}

// Default validation rules
export const DEFAULT_AI_VALIDATION: AIRequestValidation = {
  input: {
    minLength: 1,
    maxLength: 2000,
    allowedTypes: ['text']
  },
  attachments: {
    maxCount: 5,
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain']
  },
  context: {
    requiredFields: ['projectId', 'organizationId', 'userId']
  }
};

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface AIError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
  suggestedAction?: string;
}

export const AI_ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  CONTEXT_MISSING: 'CONTEXT_MISSING',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  LLM_SERVICE_ERROR: 'LLM_SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type AIErrorCode = typeof AI_ERROR_CODES[keyof typeof AI_ERROR_CODES];

// ============================================================================
// DATABASE OPERATION TYPES
// ============================================================================

export interface AITaskCreationRequest {
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  type: TaskData['type'];
  priority?: TaskData['priority'];
  tokenEstimate?: number;
  assignedAgent?: string;
  tags?: string[];
  dueDate?: Date;
  estimatedDuration?: number;
  createdBy: string;
}

export interface AIColumnCreationRequest {
  projectId: string;
  title: string;
  name: string;
  description?: string;
  color?: string;
  position?: number;
  settings?: Partial<ColumnData['settings']>;
  visibility?: ColumnData['visibility'];
  createdBy: string;
}

export interface AIProjectCreationRequest {
  organizationId: string;
  name: string;
  description?: string;
  visibility?: ProjectData['visibility'];
  settings?: Partial<ProjectData['settings']>;
  createdBy: string;
}

export interface AIAgentCreationRequest {
  organizationId: string;
  name: string;
  description: string;
  type: AgentData['type'];
  model: string;
  systemPrompt: string;
  settings?: Partial<AgentData['settings']>;
  capabilities?: string[];
  isPublic?: boolean;
  createdBy: string;
}

// ============================================================================
// AUTHORIZATION TYPES FOR AI OPERATIONS
// ============================================================================

export interface AIAuthContext {
  userId: string;
  organizationId: string;
  projectId: string;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];
}

export interface AIPermissionCheck {
  operation: 'read' | 'create' | 'update' | 'delete';
  resource: 'task' | 'column' | 'agent' | 'project' | 'organization';
  resourceId?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isAIRequest(request: any): request is AIRequest {
  return typeof request === 'object' && 
         typeof request.userId === 'string' &&
         typeof request.input === 'string' &&
         typeof request.projectId === 'string' &&
         typeof request.organizationId === 'string' &&
         typeof request.context === 'object';
}

export function isAIResponse(response: any): response is AIResponse {
  return typeof response === 'object' &&
         typeof response.type === 'string' &&
         typeof response.message === 'string' &&
         typeof response.tokensUsed === 'number' &&
         typeof response.executionTime === 'number';
}

export function isAIError(error: any): error is AIError {
  return typeof error === 'object' &&
         typeof error.code === 'string' &&
         typeof error.message === 'string' &&
         typeof error.recoverable === 'boolean';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function createAIError(code: AIErrorCode, message: string, details?: any, recoverable: boolean = true): AIError {
  return {
    code,
    message,
    details,
    recoverable,
    suggestedAction: getSuggestedAction(code)
  };
}

function getSuggestedAction(code: AIErrorCode): string {
  switch (code) {
    case AI_ERROR_CODES.VALIDATION_FAILED:
      return 'Check your request parameters and try again';
    case AI_ERROR_CODES.CONTEXT_MISSING:
      return 'Ensure you have selected a valid project';
    case AI_ERROR_CODES.INSUFFICIENT_PERMISSIONS:
      return 'Contact your organization administrator for access';
    case AI_ERROR_CODES.RATE_LIMIT_EXCEEDED:
      return 'Wait a moment before making another request';
    case AI_ERROR_CODES.LLM_SERVICE_ERROR:
      return 'Try again in a few moments';
    default:
      return 'Please try again or contact support if the problem persists';
  }
}

export function validateAIRequest(request: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!request.input || typeof request.input !== 'string') {
    errors.push('Input is required and must be a string');
  }
  
  if (!request.userId || typeof request.userId !== 'string') {
    errors.push('User ID is required');
  }
  
  if (!request.projectId || typeof request.projectId !== 'string') {
    errors.push('Project ID is required');
  }
  
  if (!request.organizationId || typeof request.organizationId !== 'string') {
    errors.push('Organization ID is required');
  }
  
  if (!request.context || typeof request.context !== 'object') {
    errors.push('Context is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// EXPORTS FOR CONTROLLER/SERVICE USE
// ============================================================================