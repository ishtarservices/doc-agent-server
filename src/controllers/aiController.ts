import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { ClaudeService } from '../services/claudeService';
import { MongoService } from '../services/mongoService';
import type { AIRequest, AIResponse, ApiResponse } from '../types';

// Request validation schema
const aiRequestSchema = z.object({
  input: z.string().min(1, 'Input is required'),
  projectId: z.string(),
  organizationId: z.string(),
  agentId: z.string().optional(),
  context: z.object({
    currentTasks: z.array(z.any()),
    currentColumns: z.array(z.any()),
    availableAgents: z.array(z.any()),
  }),
  options: z.object({
    autoAssignAgent: z.boolean(),
    createInColumn: z.string().optional(),
    maxTokens: z.number().optional(),
  }).optional(),
});

export class AIController {
  private claudeService: ClaudeService;
  private mongoService: MongoService;

  constructor() {
    this.claudeService = new ClaudeService();
    this.mongoService = new MongoService();
  }

  public processAIRequest = async (req: AuthenticatedRequest, res: Response<ApiResponse<AIResponse>>) => {
    try {
      // Validate request body
      const validationResult = aiRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          message: validationResult.error.errors.map(e => e.message).join(', '),
        });
      }

      const { input, projectId, organizationId, agentId, context, options } = validationResult.data;
      const userId = req.user?.id || 'default-user';

      console.log(`Processing AI request for user ${userId}: "${input}"`);

      // Process request with Claude
      const aiRequest: AIRequest = {
        input,
        projectId,
        organizationId,
        agentId,
        context,
        options,
      };

      const aiResponse = await this.claudeService.processAIRequest(aiRequest);

      // Handle task creation
      if (aiResponse.type === 'task_creation' && aiResponse.createdTasks && projectId) {
        try {
          const createdTasks = [];

          for (const taskData of aiResponse.createdTasks) {
            const newTask = await this.mongoService.createTask({
              projectId,
              columnId: options?.createInColumn || context.currentColumns[0]?._id || 'default-column',
              title: taskData.title,
              description: taskData.description,
              type: taskData.type,
              status: taskData.status || 'backlog',
              priority: taskData.priority || 'medium',
              tokenEstimate: taskData.tokenEstimate || 500,
              assignedAgent: options?.autoAssignAgent ? agentId : undefined,
              tags: taskData.tags || [],
              createdBy: userId,
            });

            createdTasks.push(newTask);
          }

          aiResponse.createdTasks = createdTasks;
          console.log(`Created ${createdTasks.length} tasks for user ${userId}`);

        } catch (taskCreationError) {
          console.error('Error creating tasks:', taskCreationError);
          aiResponse.message = `${aiResponse.message || 'Tasks suggested successfully.'} However, there was an issue saving them to the database.`;
        }
      }

      // Handle column creation
      if (aiResponse.type === 'task_creation' && aiResponse.createdColumns && projectId) {
        try {
          const createdColumns = [];

          for (const columnData of aiResponse.createdColumns) {
            const newColumn = await this.mongoService.createColumn({
              projectId,
              title: columnData.title,
              name: columnData.name,
              description: columnData.description,
              color: columnData.color || '#6b7280',
              position: columnData.position || 0,
              settings: columnData.settings || {
                isCollapsed: false,
                isPinned: false,
                autoRun: false,
                taskLimit: 50,
              },
              visibility: columnData.visibility || 'public',
              createdBy: userId,
            });

            createdColumns.push(newColumn);
          }

          aiResponse.createdColumns = createdColumns;
          console.log(`Created ${createdColumns.length} columns for user ${userId}`);

        } catch (columnCreationError) {
          console.error('Error creating columns:', columnCreationError);
        }
      }

      res.json({
        success: true,
        data: aiResponse,
        metadata: {
          tokensUsed: aiResponse.tokensUsed,
        },
      });

    } catch (error) {
      console.error('AI Controller Error:', error);

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  public getProjectTasks = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = req.user?.id || 'default-user';

      if (!projectId) {
        return res.status(400).json({
          error: 'Project ID is required',
        });
      }

      console.log(`Fetching tasks for project ${projectId}, user ${userId}`);

      const context = await this.mongoService.getProjectContext(projectId, userId);

      // Convert to expected format
      const formattedContext = {
        tasks: context.columns.flatMap(col => col.tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          type: task.type,
          status: task.status,
          token_estimate: task.tokenEstimate,
          project_id: task.projectId,
          created_by: task.createdBy,
          position: task.position,
        }))),
        columns: context.columns.map(col => ({
          id: col.id,
          title: col.name,
          tasks: col.tasks.map(task => ({
            id: task.id,
            title: task.title,
            description: task.description,
            type: task.type,
            status: task.status,
            token_estimate: task.tokenEstimate,
            project_id: task.projectId,
            created_by: task.createdBy,
            position: task.position,
          }))
        }))
      };

      res.json({
        success: true,
        data: formattedContext,
      });

    } catch (error) {
      console.error('Get Project Tasks Error:', error);

      res.status(500).json({
        success: false,
        error: 'Failed to fetch project tasks',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };
}