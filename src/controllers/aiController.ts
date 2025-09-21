// Enhanced AI Controller - src/controllers/enhancedAIController.ts

import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
// import { ClaudeService } from '../services/claudeService';
import { OpenAIService } from '../services/openaiService';
import { MongoService } from '../services/mongoService';
import { AIToolsService } from '../services/aiTools';
import { IntentService } from '../services/intentService';
import { Logger } from '../utils/logger';
import type {
  AIRequest,
  AIResponse,
  AIIntentAnalysis,
  AIToolContext
} from '../types/ai';
import type { ApiResponse } from '../types/index';
// Enhanced request validation schema
const enhancedAIRequestSchema = z.object({
  input: z.string().min(1, 'Input is required').max(2000, 'Input too long'),
  userId: z.string().min(1, 'User ID is required'),
  projectId: z.string(),
  organizationId: z.string(),
  agentId: z.string().optional(),
  conversationId: z.string().optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'document', 'file']),
    url: z.string(),
    name: z.string(),
    size: z.number(),
    mimeType: z.string(),
    content: z.string().optional()
  })).optional(),
  context: z.object({
    currentTasks: z.array(z.any()),
    currentColumns: z.array(z.any()),
    availableAgents: z.array(z.any()),
    project: z.any(),
    organization: z.any()
  }),
  options: z.object({
    autoAssignAgent: z.boolean().optional(),
    createInColumn: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().min(0).max(2).optional(),
    enableTools: z.boolean().optional(),
    responseFormat: z.enum(['text', 'structured']).optional(),
    priority: z.enum(['low', 'normal', 'high']).optional()
  }).optional()
});

export class EnhancedAIController {
  // private claudeService: ClaudeService;
  private openaiService: OpenAIService;
  private mongoService: MongoService;
  private aiToolsService: AIToolsService;
  private intentService: IntentService;

  constructor() {
    // this.claudeService = new ClaudeService();
    this.openaiService = new OpenAIService();
    this.mongoService = new MongoService();
    this.aiToolsService = new AIToolsService(this.mongoService);
    this.intentService = new IntentService();

    // Inject AI Tools Service into OpenAI Service for tool execution
    this.openaiService.setAIToolsService(this.aiToolsService);
  }

  public processAIRequest = async (req: AuthenticatedRequest, res: Response<ApiResponse<AIResponse>>) => {
    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      // Validate request body
      const validationResult = enhancedAIRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        Logger.warn('AI request validation failed', req, {
          errors: validationResult.error.errors
        });
        
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          message: validationResult.error.errors.map(e => e.message).join(', ')
        });
      }

      const aiRequest = validationResult.data as AIRequest;
      const userId = req.user?.id || aiRequest.userId;

      Logger.info('Processing AI request', req, {
        userId,
        projectId: aiRequest.projectId,
        organizationId: aiRequest.organizationId,
        inputLength: aiRequest.input.length,
        hasAttachments: !!aiRequest.attachments?.length,
        attachmentCount: aiRequest.attachments?.length || 0
      });

      // Access verification is now handled by requireProjectAccess middleware

      // Analyze intent using OpenAI-powered IntentService
      const intentAnalysis = await this.intentService.analyzeIntent(aiRequest);
      
      Logger.info('Intent analysis completed', req, {
        primaryIntent: intentAnalysis.intent.primary,
        secondaryIntent: intentAnalysis.intent.secondary,
        confidence: intentAnalysis.intent.confidence
      });

      // Create tool context
      const toolContext: AIToolContext = {
        userId,
        projectId: aiRequest.projectId,
        organizationId: aiRequest.organizationId,
        mongoService: this.mongoService
      };

      let aiResponse: AIResponse;

      // Always let OpenAI decide whether to use tools - remove the intent-based routing
      // OpenAI will determine if tools are needed and which ones to call
      if (aiRequest.options?.enableTools !== false) {
        aiResponse = await this.processToolBasedRequest(aiRequest, intentAnalysis, toolContext);
      } else {
        aiResponse = await this.processConversationalRequest(aiRequest, intentAnalysis);
      }

      // Update token usage
      tokensUsed = aiResponse.tokensUsed;
      aiResponse.executionTime = Date.now() - startTime;

      // Log successful completion
      Logger.api('AI request completed successfully', req, res, {
        userId,
        projectId: aiRequest.projectId,
        responseType: aiResponse.type,
        tokensUsed,
        executionTime: aiResponse.executionTime,
        createdTasks: aiResponse.createdTasks?.length || 0,
        updatedTasks: aiResponse.updatedTasks?.length || 0,
        toolsUsed: aiResponse.toolResults?.map(tr => tr.tool)
      });

      // Track usage metrics for analytics
      await this.trackUsageMetrics(userId, aiRequest.organizationId, aiRequest.projectId, aiResponse);

      res.json({
        success: true,
        data: aiResponse,
        metadata: {
          tokensUsed
        }
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      Logger.error('AI Controller Error', req, error, {
        executionTime,
        tokensUsed
      });

      // Return appropriate error response based on error type
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: 'Too many AI requests. Please try again later.'
          });
        }
        
        if (error.message.includes('insufficient permissions')) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            message: 'You do not have permission to perform this action.'
          });
        }
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process AI request. Please try again.'
      });
    }
  };

  // ============================================================================
  // ENHANCED PROCESSING METHODS
  // ============================================================================

  // ============================================================================
  // REQUEST PROCESSING METHODS
  // ============================================================================

  private async processToolBasedRequest(
    request: AIRequest,
    intentAnalysis: AIIntentAnalysis,
    toolContext: AIToolContext
  ): Promise<AIResponse> {
    Logger.info('Processing tool-based request', undefined, {
      intent: intentAnalysis.intent.primary
    });

    // Get available tools from AI Tools Service
    const availableTools = this.aiToolsService.getAvailableTools();

    // Use OpenAI service with tools for intelligent tool selection and execution
    const openaiResponse = await this.openaiService.processWithTools(
      request,
      availableTools,
      toolContext
    );

    const aiResponse: AIResponse = {
      type: this.mapIntentToResponseType(intentAnalysis.intent.primary),
      message: openaiResponse.message,
      tokensUsed: openaiResponse.tokensUsed,
      executionTime: 0,
      suggestions: openaiResponse.suggestions,
      toolResults: []
    };

    // Process tool calls if any were made
    if (openaiResponse.toolCalls && openaiResponse.toolCalls.length > 0) {
      for (const toolCall of openaiResponse.toolCalls) {
        aiResponse.toolResults!.push({
          tool: toolCall.name,
          success: true, // Tools are executed within OpenAI service now
          result: toolCall.parameters,
          error: undefined
        });

        // Aggregate created/updated items based on tool name
        this.aggregateToolResultsFromToolCall(aiResponse, toolCall);
      }
    }

    return aiResponse;
  }


  private async processConversationalRequest(
    request: AIRequest,
    intentAnalysis: AIIntentAnalysis
  ): Promise<AIResponse> {
    Logger.info('Processing conversational request', undefined, {
      intent: intentAnalysis.intent.primary,
      confidence: intentAnalysis.intent.confidence
    });

    // Use OpenAI for general conversation and advice
    const openaiResponse = await this.openaiService.processConversation(request);

    return {
      type: 'general_answer',
      message: openaiResponse.message,
      tokensUsed: openaiResponse.tokensUsed,
      executionTime: 0,
      confidence: intentAnalysis.intent.confidence,
      suggestions: openaiResponse.suggestions
    };
  }

  // Removed unused buildToolInstructions method - intent is now handled by OpenAI service


  private mapIntentToResponseType(intent: string): AIResponse['type'] {
    switch (intent) {
      case 'task_creation': return 'task_creation';
      case 'task_management': return 'task_management';
      case 'agent_assignment': return 'agent_assignment';
      case 'project_management': return 'project_management';
      case 'agent_use': return 'tool_execution';
      case 'error': return 'error';
      case 'other': return 'general_answer';
      case 'general_answer': return 'general_answer';
      default: return 'general_answer';
    }
  }

  private aggregateToolResultsFromToolCall(aiResponse: AIResponse, toolCall: any) {
    // Extract information from tool call parameters to understand what was created/modified
    // Note: These are simplified records for response aggregation, not full data objects
    switch (toolCall.name) {
      case 'create_task':
        aiResponse.createdTasks = aiResponse.createdTasks || [];
        // Store task creation info (will be populated with actual data when tool executes)
        break;
      case 'create_column':
        aiResponse.createdColumns = aiResponse.createdColumns || [];
        // Store column creation info (will be populated with actual data when tool executes)
        break;
      case 'create_project':
        aiResponse.createdProjects = aiResponse.createdProjects || [];
        // Store project creation info (will be populated with actual data when tool executes)
        break;
      case 'update_task':
      case 'move_task':
        aiResponse.updatedTasks = aiResponse.updatedTasks || [];
        // Store task update info (will be populated with actual data when tool executes)
        break;
      case 'update_column':
        aiResponse.updatedColumns = aiResponse.updatedColumns || [];
        // Store column update info (will be populated with actual data when tool executes)
        break;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async trackUsageMetrics(
    userId: string,
    organizationId: string,
    projectId: string,
    response: AIResponse
  ): Promise<void> {
    try {
      // This would typically be sent to an analytics service
      const metrics = {
        userId,
        organizationId,
        projectId,
        timestamp: new Date(),
        tokensUsed: response.tokensUsed,
        executionTime: response.executionTime,
        requestType: response.type,
        success: true,
        toolsUsed: response.toolResults?.map(tr => tr.tool) || []
      };

      Logger.info('AI usage metrics', undefined, metrics);

      // TODO: Implement actual metrics tracking
      // await this.metricsService.track(metrics);
    } catch (error) {
      Logger.error('Error tracking usage metrics', undefined, error);
      // Don't fail the request if metrics tracking fails
    }
  }
}