import { AIRequest, AIResponse, ClaudeAPIResponse, ClaudeMessage } from '../types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages';

// Debug logging for environment variables
if (!CLAUDE_API_KEY) {
  console.error('🚨 CLAUDE_API_KEY not found in environment variables');
  console.error('Available env vars:', Object.keys(process.env).filter(key => key.startsWith('CLAUDE')));
} else {
  console.log('✅ CLAUDE_API_KEY loaded successfully (length:', CLAUDE_API_KEY.length, ')');
}

const SYSTEM_PROMPT = `You are an AI assistant for a dynamic task board application with MongoDB database. Users can ask questions or request task and column management operations.

CAPABILITIES:
- Create/manage dynamic columns beyond default statuses
- Create tasks in any column (existing or new)
- Move and organize tasks between columns
- Suggest project-specific organization

TASK TYPES: email, doc, code, research
DEFAULT COLUMNS: backlog, ready, in_progress, done (but you can create custom ones)

Analyze the user input and determine if they want to:
1. Ask a general question (type: "general_answer") - respond with helpful information
2. Create new tasks/columns (type: "task_creation") - extract details and create structure
3. Manage existing tasks/columns (type: "task_management") - modify, move, or organize

For task creation:
- Estimate realistic token counts (email: 500-1000, doc: 1000-2000, code: 1500-3000, research: 800-1500)
- You can specify custom columns for tasks using the "column" field
- Create new columns when tasks need project-specific organization

CRITICAL: Always respond with valid JSON in this EXACT format:
{
  "type": "general_answer|task_creation|task_management",
  "message": "Your response message",
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description",
      "type": "email|doc|code|research",
      "status": "backlog|ready|in_progress|done",
      "tokenEstimate": 1000,
      "column": "optional custom column name"
    }
  ],
  "columns": [
    {
      "title": "Column Name",
      "description": "Why this column is needed"
    }
  ]
}

EXAMPLES:
- "Create marketing tasks" → task_creation with Marketing column + related tasks
- "Set up development workflow" → task_creation with Development, Testing, Deployment columns
- "Organize research project" → task_creation with Research, Analysis, Documentation columns
- Custom project needs → create appropriate columns and assign tasks

Always suggest logical column organization for complex projects.`;

export class ClaudeService {
  private async makeClaudeRequest(messages: ClaudeMessage[]): Promise<ClaudeAPIResponse> {
    if (!CLAUDE_API_KEY) {
      throw new Error('Claude API key not configured');
    }

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'messages-2023-12-15',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errorText}`);
    }

    return await response.json() as ClaudeAPIResponse;
  }

  public async processAIRequest(request: AIRequest): Promise<AIResponse> {
    try {
      const { input, currentTasks = [], currentColumns = [], projectId, userId } = request;

      if (!input?.trim()) {
        throw new Error('Input is required');
      }

      // Prepare context for Claude
      const context = {
        currentTasks,
        currentColumns,
        projectId,
        userId,
      };

      const messages: ClaudeMessage[] = [
        {
          role: 'user',
          content: `Context: ${JSON.stringify(context)}

User input: ${input}`
        }
      ];

      console.log('Sending request to Claude API...');
      const claudeResponse = await this.makeClaudeRequest(messages);
      console.log('Received response from Claude API');

      const content = claudeResponse.content[0]?.text;
      if (!content) {
        throw new Error('No content in Claude response');
      }

      // Try to parse as JSON
      try {
        const aiResponse: AIResponse = JSON.parse(content);

        // Validate response structure
        if (!aiResponse.type || !['general_answer', 'task_creation', 'task_management'].includes(aiResponse.type)) {
          throw new Error('Invalid response type from Claude');
        }

        return aiResponse;
      } catch (parseError) {
        console.warn('Failed to parse Claude response as JSON, treating as general answer:', parseError);
        // If parsing fails, return a general answer
        return {
          type: 'general_answer',
          message: content,
        };
      }
    } catch (error) {
      console.error('Claude Service Error:', error);

      // Return user-friendly error response
      return {
        type: 'general_answer',
        message: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
      };
    }
  }
}