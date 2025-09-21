// Intent Classification Service using OpenAI GPT-4o Mini
// Optimized for fast, cost-effective intent classification

import OpenAI from 'openai';
import { Logger } from '../utils/logger';
import type { AIRequest, AIIntentAnalysis, AIIntent } from '../types/ai';

interface IntentClassificationRequest {
  input: string;
  context: {
    currentTasks: number;
    currentColumns: string[];
    availableAgents: string[];
    projectName: string;
    organizationName: string;
  };
}

interface OpenAIIntentResponse {
  intent: {
    primary: AIIntent['primary'];
    secondary?: string;
    confidence: number;
  };
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  reasoning: string;
}

export class IntentService {
  private openai: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor() {
    // Validate OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });

    // Use GPT-4o Mini for optimal cost/performance for intent classification
    this.model = 'gpt-4o-mini';
    this.maxTokens = 300; // Keep response compact for speed
    this.temperature = 0.1; // Low temperature for consistent intent classification
  }

  /**
   * Analyzes user input to determine intent and required actions
   */
  async analyzeIntent(request: AIRequest): Promise<AIIntentAnalysis> {
    const startTime = Date.now();

    try {
      const intentRequest: IntentClassificationRequest = {
        input: request.input,
        context: {
          currentTasks: request.context.currentTasks.length,
          currentColumns: request.context.currentColumns.map(c => c.title || c.name),
          availableAgents: request.context.availableAgents.map(a => a.name),
          projectName: request.context.project.name,
          organizationName: request.context.organization.name,
        }
      };

      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(intentRequest);

      Logger.info('Analyzing intent with OpenAI', undefined, {
        model: this.model,
        inputLength: request.input.length,
        projectId: request.projectId,
        userId: request.userId
      });

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' }
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('Empty response from OpenAI');
      }

      const intentResponse: OpenAIIntentResponse = JSON.parse(responseContent);
      const executionTime = Date.now() - startTime;

      Logger.info('Intent analysis completed', undefined, {
        intent: intentResponse.intent.primary,
        secondary: intentResponse.intent.secondary,
        confidence: intentResponse.intent.confidence,
        executionTime,
        tokensUsed: completion.usage?.total_tokens || 0
      });

      // Convert OpenAI response to our AIIntentAnalysis format
      const analysis: AIIntentAnalysis = {
        intent: {
          primary: intentResponse.intent.primary,
          secondary: intentResponse.intent.secondary,
          confidence: intentResponse.intent.confidence,
          entities: intentResponse.entities.map(entity => ({
            type: entity.type as any,
            value: entity.value,
            confidence: entity.confidence
          }))
        }
      };

      return analysis;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      Logger.error('Intent analysis failed', undefined, error, {
        executionTime,
        model: this.model,
        inputLength: request.input.length
      });

      // Fallback to basic intent analysis if OpenAI fails
      return this.getFallbackIntent(request);
    }
  }

  /**
   * Builds the system prompt for intent classification
   */
  private buildSystemPrompt(): string {
    return `You are an expert intent classifier for a task management and project automation system. Your job is to analyze user requests and classify their intent with high accuracy.

SYSTEM OVERVIEW:
- Users manage projects with tasks organized in columns (like Kanban boards)
- AI agents can be assigned to tasks to execute them automatically
- Users can create, update, delete, move, and analyze tasks, columns, projects, and agents
- The system supports real-time collaboration and automation

INTENT CATEGORIES:
1. "general_answer" - General questions, requests for information, explanations
2. "task_creation" - Creating new tasks
3. "task_management" - Managing existing tasks (edit, move, delete, update)
4. "agent_assignment" - Assigning agents to tasks or managing agent assignments
5. "project_management" - Project-level operations (create, update projects/columns)
6. "agent_use" - Using or executing agents on tasks
7. "other" - Other operations not covered by specific categories
8. "error" - Invalid or problematic requests

RESPONSE TYPES:
- "general_answer" - For questions, explanations, general conversation
- "task_creation" - When creating new tasks
- "task_management" - For task updates, moves, deletions
- "agent_assignment" - When assigning or managing agents
- "project_management" - For project-level operations
- "error" - For invalid or problematic requests
- "tool_execution" - For complex operations requiring multiple tools

ANALYSIS REQUIREMENTS:
1. Classify the PRIMARY intent with high confidence
2. Identify SECONDARY intent for more specific actions
3. Extract relevant ENTITIES (priorities, statuses, task types, dates, etc.)

ENTITY TYPES TO EXTRACT:
- task: Task-related keywords (bug, feature, research, etc.)
- priority: urgent, high, medium, low
- status: backlog, ready, in progress, done, blocked, cancelled
- column: Column/list names or references
- agent: Agent names or AI-related terms
- project: Project-related terms
- user: User names or assignments
- date: Time references or deadlines

OUTPUT FORMAT:
Return a valid JSON object with this exact structure:
{
  "intent": {
    "primary": "general_answer|task_creation|task_management|agent_assignment|project_management|agent_use|other|error",
    "secondary": "specific_action_type",
    "confidence": 0.0-1.0
  },
  "entities": [
    {
      "type": "entity_type",
      "value": "extracted_value",
      "confidence": 0.0-1.0
    }
  ],
  "reasoning": "brief explanation of classification"
}

IMPORTANT:
- Be precise and consistent with classifications
- High confidence (>0.8) for clear intents, lower for ambiguous ones
- Consider context when making decisions
- Provide brief reasoning for your classification`;
  }

  /**
   * Builds the user prompt with context
   */
  private buildUserPrompt(request: IntentClassificationRequest): string {
    return `Analyze the following user request and classify its intent:

USER INPUT: "${request.input}"

CURRENT CONTEXT:
- Project: ${request.context.projectName}
- Organization: ${request.context.organizationName}
- Current Tasks: ${request.context.currentTasks}
- Available Columns: ${request.context.currentColumns.join(', ')}
- Available Agents: ${request.context.availableAgents.join(', ')}

Classify this request and return your analysis in the required JSON format.`;
  }

  /**
   * Provides fallback intent analysis if OpenAI fails
   */
  private getFallbackIntent(request: AIRequest): AIIntentAnalysis {
    const input = request.input.toLowerCase();

    // Simple keyword-based fallback
    let primary: AIIntent['primary'] = 'general_answer';
    let confidence = 0.3; // Lower confidence for fallback

    // Basic intent detection
    if (this.containsCreateTaskKeywords(input)) {
      primary = 'task_creation';
      confidence = 0.6;
    } else if (this.containsTaskManagementKeywords(input)) {
      primary = 'task_management';
      confidence = 0.6;
    } else if (this.containsAgentKeywords(input)) {
      primary = 'agent_assignment';
      confidence = 0.6;
    } else if (this.containsProjectKeywords(input)) {
      primary = 'project_management';
      confidence = 0.5;
    } else if (this.containsAgentUseKeywords(input)) {
      primary = 'agent_use';
      confidence = 0.6;
    }

    Logger.warn('Using fallback intent analysis', undefined, {
      intent: primary,
      confidence,
      reason: 'OpenAI intent service failed'
    });

    return {
      intent: {
        primary,
        confidence,
        entities: []
      }
    };
  }

  // Helper methods for fallback analysis
  private containsCreateTaskKeywords(input: string): boolean {
    const keywords = ['create task', 'add task', 'new task', 'make task'];
    return keywords.some(keyword => input.includes(keyword));
  }

  private containsTaskManagementKeywords(input: string): boolean {
    const keywords = ['update task', 'edit task', 'move task', 'delete task', 'modify task', 'change task'];
    return keywords.some(keyword => input.includes(keyword));
  }

  private containsAgentKeywords(input: string): boolean {
    const keywords = ['assign agent', 'agent assignment', 'assign to agent', 'agent to task'];
    return keywords.some(keyword => input.includes(keyword));
  }

  private containsProjectKeywords(input: string): boolean {
    const keywords = ['create project', 'create column', 'project management', 'column management'];
    return keywords.some(keyword => input.includes(keyword));
  }

  private containsAgentUseKeywords(input: string): boolean {
    const keywords = ['run agent', 'execute agent', 'use agent', 'agent execution'];
    return keywords.some(keyword => input.includes(keyword));
  }

  /**
   * Gets usage statistics for monitoring
   */
  async getUsageStats(): Promise<{
    totalRequests: number;
    averageLatency: number;
    errorRate: number;
  }> {
    // TODO: Implement usage tracking
    return {
      totalRequests: 0,
      averageLatency: 0,
      errorRate: 0
    };
  }
}