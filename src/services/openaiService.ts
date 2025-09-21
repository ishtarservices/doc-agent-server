// OpenAI Service - src/services/openaiService.ts

import OpenAI from 'openai';
import type {
  AIRequest,
  AIResponse,
  AITool,
  AIToolContext,
  OpenAIResponse,
  OpenAIToolCall
} from '../types/ai';
import type { AIToolsService } from './aiTools';
import { Logger } from '../utils/logger';

// Interface for OpenAI service request (simplified from AIRequest) - backward compatibility
interface OpenAIServiceRequest {
  input: string;
  currentTasks: any[];
  currentColumns: any[];
  projectId: string;
  userId: string;
}

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

export class OpenAIService {
  private client: OpenAI;
  private model: string = 'gpt-4o-2024-08-06'; // Best model for function calling based on research
  private aiToolsService: AIToolsService | null = null;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  // Inject AI Tools Service for tool execution
  public setAIToolsService(aiToolsService: AIToolsService): void {
    this.aiToolsService = aiToolsService;
  }

  // ============================================================================
  // MAIN PROCESSING METHODS
  // ============================================================================

  public async processWithTools(
    request: AIRequest,
    availableTools: AITool[],
    toolContext: AIToolContext
  ): Promise<OpenAIResponse> {
    const startTime = Date.now();

    Logger.info('🤖 Starting OpenAI API request', undefined, {
      projectId: request.projectId,
      userId: request.userId,
      inputLength: request.input.length,
      toolsAvailable: availableTools.length,
      model: this.model
    });

    try {
      // Convert our AITool format to OpenAI's function format
      const openaiTools = availableTools.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));

      // Build system message with context
      const systemMessage = this.buildSystemMessage(request, availableTools);

      // Format user message with attachments if any
      const userMessage = this.formatUserMessage(request.input, request.attachments);

      const messages = [
        { role: 'system' as const, content: systemMessage },
        userMessage
      ];

      const completionParams: any = {
        model: this.model,
        messages,
        max_tokens: request.options?.maxTokens || 4000,
        temperature: request.options?.temperature || 0.3,
      };

      // Add tools if available
      if (openaiTools.length > 0) {
        completionParams.tools = openaiTools;
        completionParams.tool_choice = 'auto';
      }

      const response = await this.client.chat.completions.create(completionParams);

      Logger.info('🤖 OpenAI API response received', undefined, {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        responseTime: Date.now() - startTime,
        hasToolCalls: (response.choices[0]?.message?.tool_calls?.length || 0) > 0
      });

      // Parse the response and execute tools if needed
      const result = await this.parseOpenAIResponse(response, toolContext);

      if (result.toolCalls && result.toolCalls.length > 0) {
        Logger.info('🛠️ Tools executed', undefined, {
          toolsUsed: result.toolCalls.map(tc => tc.name),
          toolCount: result.toolCalls.length
        });
      }

      return {
        message: result.message,
        tokensUsed: response.usage?.total_tokens || 0,
        toolCalls: result.toolCalls,
        suggestions: result.suggestions
      };

    } catch (error) {
      Logger.error('🚨 OpenAI API error', undefined, error, {
        projectId: request.projectId,
        userId: request.userId,
        responseTime: Date.now() - startTime,
        errorType: error instanceof Error ? error.name : 'Unknown'
      });
      throw error instanceof Error ? error : new Error('Failed to process request with OpenAI');
    }
  }

  public async processConversation(request: AIRequest): Promise<OpenAIResponse> {
    try {
      const systemMessage = this.buildConversationalSystemMessage(request);
      const userMessage = this.formatUserMessage(request.input, request.attachments);

      const messages = [
        { role: 'system' as const, content: systemMessage },
        userMessage
      ];

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: request.options?.maxTokens || 2000,
        temperature: request.options?.temperature || 0.7,
      });

      const result = await this.parseOpenAIResponse(response);

      return {
        message: result.message,
        tokensUsed: response.usage?.total_tokens || 0,
        suggestions: this.generateSuggestions(request)
      };

    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to process conversational request');
    }
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY METHOD
  // ============================================================================

  public async processAIRequest(request: OpenAIServiceRequest): Promise<AIResponse> {
    try {
      const { input, projectId, userId, currentTasks = [], currentColumns = [] } = request;

      if (!input?.trim()) {
        throw new Error('Input is required');
      }

      // Convert to full AIRequest format
      const fullRequest: AIRequest = {
        input,
        userId,
        projectId,
        organizationId: '', // Will be filled by controller
        context: {
          currentTasks,
          currentColumns,
          availableAgents: [],
          project: { name: 'Current Project' } as any,
          organization: { name: 'Current Organization' } as any
        }
      };

      // Use conversational processing for backward compatibility
      const openaiResponse = await this.processConversation(fullRequest);

      // Try to parse message as structured response for backward compatibility
      try {
        const structuredResponse = JSON.parse(openaiResponse.message);
        const validTypes = ['general_answer', 'task_creation', 'task_management', 'agent_assignment', 'project_management', 'agent_use', 'other', 'error'];

        if (structuredResponse.type && validTypes.includes(structuredResponse.type)) {
          return {
            ...structuredResponse,
            tokensUsed: openaiResponse.tokensUsed,
            executionTime: 0
          };
        }
      } catch {
        // Not structured, continue with conversational response
      }

      return {
        type: 'general_answer',
        message: openaiResponse.message,
        tokensUsed: openaiResponse.tokensUsed,
        executionTime: 0,
        suggestions: openaiResponse.suggestions
      };

    } catch (error) {
      return {
        type: 'error',
        message: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        tokensUsed: 0,
        executionTime: 0
      };
    }
  }

  // ============================================================================
  // MESSAGE FORMATTING
  // ============================================================================

  private buildSystemMessage(request: AIRequest, availableTools: AITool[]): string {
    return `You are an AI assistant specialized in project management and task organization. You help users manage their projects, tasks, and workflows efficiently.

CURRENT CONTEXT:
- Project: ${request.context.project.name}
- Organization: ${request.context.organization.name}
- Tasks: ${request.context.currentTasks.length} total
- Columns: ${request.context.currentColumns.map(c => c.title || c.name).join(', ')}
- Available Agents: ${request.context.availableAgents.length}

AVAILABLE TOOLS:
${availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

INSTRUCTIONS:
1. Analyze the user's request carefully to understand their intent
2. Use the appropriate tools to fulfill their request when database modifications are needed
3. For task creation, always include meaningful titles, descriptions, and appropriate types/priorities
4. When creating multiple tasks, organize them logically and assign appropriate columns
5. For analysis requests, provide clear insights and actionable recommendations
6. Always confirm what actions you're taking and explain the results

RESPONSE FORMAT:
- Use tools when the user wants to create, update, delete, or analyze data
- Provide clear, conversational responses that explain what you did
- Include relevant details about created/modified items
- Suggest follow-up actions when appropriate

Remember: You can see the current state of the project and should reference it in your responses.`;
  }

  private buildConversationalSystemMessage(request: AIRequest): string {
    return `You are an AI assistant for project management. You're having a conversation with a user about their project: "${request.context.project.name}".

CURRENT PROJECT STATE:
- Total Tasks: ${request.context.currentTasks.length}
- Columns: ${request.context.currentColumns.map(c => c.title || c.name).join(', ')}
- Available Agents: ${request.context.availableAgents.length}

TASK BREAKDOWN:
${this.summarizeTaskBreakdown(request.context.currentTasks)}

Your role is to:
1. Answer questions about the project and tasks
2. Provide advice on project management best practices
3. Suggest improvements to workflow and organization
4. Help with planning and prioritization

Be helpful, concise, and actionable in your responses. Reference the current project state when relevant.`;
  }

  private formatUserMessage(content: string, attachments?: any[]): any {
    const messageContent: any[] = [
      {
        type: "text",
        text: content
      }
    ];

    // Add image attachments if any
    if (attachments) {
      for (const attachment of attachments) {
        if (attachment.type === 'image' && attachment.content) {
          messageContent.push({
            type: "image_url",
            image_url: {
              url: `data:${attachment.mimeType};base64,${attachment.content}`
            }
          });
        }
      }
    }

    return {
      role: "user" as const,
      content: messageContent.length === 1 ? content : messageContent
    };
  }

  // ============================================================================
  // RESPONSE PARSING
  // ============================================================================

  private async parseOpenAIResponse(response: any, toolContext?: AIToolContext): Promise<{ message: string; toolCalls?: OpenAIToolCall[]; suggestions?: string[] }> {
    let message = '';
    const toolCalls: OpenAIToolCall[] = [];

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response choices received from OpenAI');
    }

    const responseMessage = choice.message;

    // Get text content
    if (responseMessage.content) {
      message += responseMessage.content;
    }

    // Handle tool calls
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type === 'function') {
          const functionCall = toolCall.function;
          let parameters;

          try {
            parameters = JSON.parse(functionCall.arguments);
          } catch (error) {
            Logger.warn('Failed to parse tool call arguments', undefined, {
              toolName: functionCall.name,
              arguments: functionCall.arguments,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            continue;
          }

          toolCalls.push({
            name: functionCall.name,
            parameters
          });

          // Execute tool if we have the tools service and context
          if (this.aiToolsService && toolContext) {
            try {
              const toolResult = await this.aiToolsService.executeTool(
                functionCall.name,
                parameters,
                toolContext
              );

              if (toolResult.success) {
                message += `\n\n✅ Successfully executed ${functionCall.name}: ${JSON.stringify(toolResult.data)}`;
              } else {
                message += `\n\n❌ Failed to execute ${functionCall.name}: ${toolResult.error}`;
              }
            } catch (error) {
              message += `\n\n❌ Error executing ${functionCall.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          }
        }
      }
    }

    // Extract suggestions from the message
    const suggestions = this.extractSuggestions(message);

    return {
      message: message.trim(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      suggestions
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private extractSuggestions(message: string): string[] {
    const suggestions: string[] = [];

    // Look for common suggestion patterns
    const suggestionPatterns = [
      /you might want to (.*?)(?:\.|$)/gi,
      /consider (.*?)(?:\.|$)/gi,
      /i suggest (.*?)(?:\.|$)/gi,
      /you could (.*?)(?:\.|$)/gi
    ];

    for (const pattern of suggestionPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        if (match[1]) {
          suggestions.push(match[1].trim());
        }
        // Reset lastIndex to avoid infinite loop with global regex
        if (!pattern.global) break;
      }
      // Reset lastIndex for next iteration
      pattern.lastIndex = 0;
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  private summarizeTaskBreakdown(tasks: any[]): string {
    const statusCounts = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    const priorityCounts = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {});

    return `Status: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}
Priority: ${Object.entries(priorityCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
  }

  private generateSuggestions(request: AIRequest): string[] {
    const suggestions: string[] = [];
    const taskCount = request.context.currentTasks.length;
    const columnCount = request.context.currentColumns.length;

    // Generate contextual suggestions
    if (taskCount === 0) {
      suggestions.push('Create your first task to get started');
    } else if (taskCount > 20) {
      suggestions.push('Consider organizing tasks into different projects');
    }

    if (columnCount < 4) {
      suggestions.push('Add more columns to better organize your workflow');
    }

    const inProgressTasks = request.context.currentTasks.filter(t => t.status === 'in_progress');
    if (inProgressTasks.length > 5) {
      suggestions.push('You have many tasks in progress - consider focusing on fewer items');
    }

    return suggestions.slice(0, 3);
  }
}