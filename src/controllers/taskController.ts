import { Response } from 'express';
import { MongoService } from '../services/mongoService';
import { AuthenticatedRequest } from '../middleware/auth';
import { AgentController } from './agentController';
import { Logger } from '../utils/logger';
import type {
  TaskData,
  CreateTaskRequest,
  UpdateTaskRequest,
  MoveTaskRequest,
  AssignAgentRequest,
  RunAgentRequest,
  ApiResponse,
} from '../types';

// Create service instance on-demand to avoid initialization timing issues
const getMongoService = () => new MongoService();

export class TaskController {
  static async getTask(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData>>) {
    try {
      // Task data is already validated and attached by authorization middleware
      if (!req.task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      res.json({
        success: true,
        data: req.task,
      });
    } catch (error) {
      console.error('Get Task Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async createTask(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData>>) {
    try {
      const createData: CreateTaskRequest = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      Logger.api('📝 Creating task', req, undefined, {
        requestBody: req.body,
        userId,
        projectId: createData.projectId,
        columnId: createData.columnId,
        taskTitle: createData.title,
        taskType: createData.type,
      });

      // Verify user has access to the project and column
      Logger.db('🔍 Checking project access for task creation', req, {
        projectId: createData.projectId,
        userId,
      });

      const hasProjectAccess = await mongoService.hasProjectAccess(createData.projectId, userId);
      if (!hasProjectAccess) {
        Logger.api('❌ Project access denied for task creation', req, res, {
          projectId: createData.projectId,
          userId,
          hasAccess: false,
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have access to this project',
        });
      }

      // Check if user can create tasks (editor or owner role)
      Logger.db('🔍 Checking user role for task creation', req, { projectId: createData.projectId, userId });
      const project = await mongoService.getProject(createData.projectId);
      if (project) {
        const projectMembership = project.members.find(member => member.userId === userId);
        const userRole = projectMembership?.role || 'viewer';

        Logger.api('👤 Checking task creation permissions', req, undefined, {
          userId,
          userRole,
          projectMembership: !!projectMembership,
          requiredRoles: ['owner', 'editor'],
          hasPermission: ['owner', 'editor'].includes(userRole),
        });

        if (!['owner', 'editor'].includes(userRole)) {
          Logger.api('❌ Insufficient role for task creation', req, res, {
            userRole,
            requiredRoles: ['owner', 'editor'],
          });
          return res.status(403).json({
            success: false,
            error: 'Access denied: Editor or owner role required to create tasks',
          });
        }
      }

      // Process assignees to include full user data
      const processedAssignees = createData.assignees?.map(assignee => ({
        userId: assignee.userId,
        name: 'User Name', // TODO: Get from user service
        email: 'user@example.com', // TODO: Get from user service
        role: assignee.role,
        assignedAt: new Date(),
        initials: 'UN', // TODO: Generate from name
      })) || [];

      const taskData = {
        ...createData,
        priority: createData.priority || 'medium',
        status: createData.status || 'backlog',
        agentHistory: createData.agents && createData.agents.length > 0 ? createData.agents.map(agent => ({
          agentId: agent.agentId,
          assignedAt: new Date(),
          assignedBy: userId,
        })) : [],
        tokenEstimate: createData.tokenEstimate || 500,
        actualTokensUsed: 0,
        progressPercentage: 0,
        assignees: processedAssignees,
        tags: createData.tags || [],
        position: 0, // TODO: Calculate based on existing tasks in column
        dependencies: createData.dependencies || [],
        blockedBy: [],
        subtasks: [],
        timeSpent: 0,
        createdBy: userId,
      };

      const newTask = await mongoService.createTask(taskData, userId);

      res.status(201).json({
        success: true,
        data: newTask,
      });
    } catch (error) {
      console.error('Create Task Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async updateTask(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData>>) {
    try {
      const { taskId } = req.params;
      const updates: UpdateTaskRequest = req.body;
      const userId = req.user?.id;
      const mongoService = getMongoService();

      // Task access is already validated by authorization middleware
      // Check if user has editor or owner role in the project
      const userRole = req.projectMembership?.role || 'viewer';
      if (!['owner', 'editor'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Editor or owner role required to update tasks',
        });
      }

      // Process assignees if provided
      if (updates.assignees) {
        updates.assignees = updates.assignees.map(assignee => ({
          userId: assignee.userId,
          name: 'User Name', // TODO: Get from user service
          email: 'user@example.com', // TODO: Get from user service
          role: assignee.role,
          assignedAt: new Date(),
          initials: 'UN', // TODO: Generate from name
        }));
      }

      const updatedTask = await mongoService.updateTask(taskId, updates);
      if (!updatedTask) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      res.json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      console.error('Update Task Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async deleteTask(req: AuthenticatedRequest, res: Response<ApiResponse<void>>) {
    try {
      const { taskId } = req.params;
      const mongoService = getMongoService();

      // Task access is already validated by authorization middleware
      // Check if user has editor or owner role in the project
      const userRole = req.projectMembership?.role || 'viewer';
      if (!['owner', 'editor'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Editor or owner role required to delete tasks',
        });
      }

      const deleted = await mongoService.deleteTask(taskId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      res.json({
        success: true,
        message: 'Task deleted successfully',
      });
    } catch (error) {
      console.error('Delete Task Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async moveTask(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData>>) {
    try {
      const { taskId } = req.params;
      const { columnId, position }: MoveTaskRequest = req.body;
      const userId = req.user?.id;
      const mongoService = getMongoService();

      // Task access is already validated by authorization middleware
      // Check if user has editor or owner role in the project
      const userRole = req.projectMembership?.role || 'viewer';
      if (!['owner', 'editor'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Editor or owner role required to move tasks',
        });
      }

      // Get the column to determine status
      const column = await mongoService.getColumn(columnId);
      if (!column) {
        return res.status(404).json({
          success: false,
          error: 'Column not found',
        });
      }

      // Verify column belongs to the same project
      if (column.projectId !== req.task?.projectId) {
        return res.status(403).json({
          success: false,
          error: 'Cannot move task to column in different project',
        });
      }

      // Map column names to task statuses
      const statusMap: Record<string, TaskData['status']> = {
        'backlog': 'backlog',
        'ready': 'ready',
        'in_progress': 'in_progress',
        'done': 'done',
      };

      const newStatus = statusMap[column.name?.toLowerCase() || ''] || 'backlog';

      const updatedTask = await mongoService.updateTask(taskId, {
        columnId,
        status: newStatus,
        position,
      });

      if (!updatedTask) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      // Auto-run agent if column has auto-run enabled
      if (column.settings.autoRun && column.settings.autoRunAgent) {
        try {
          // Create a mock request for agent execution
          const mockReq = {
            ...req,
            params: { taskId },
            body: {
              agentId: column.settings.autoRunAgent,
              options: {}
            },
          } as unknown as AuthenticatedRequest;

          // Execute agent (this will be async but we don't wait for it)
          setTimeout(() => {
            AgentController.runAgent(mockReq, res);
          }, 100);
        } catch (agentError) {
          console.error('Auto-run agent error:', agentError);
        }
      }

      res.json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      console.error('Move Task Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to move task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async assignAgent(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData>>) {
    // Delegate to AgentController
    return AgentController.assignAgentsToTask(req, res);
  }

  static async runAgent(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData>>) {
    // Delegate to AgentController
    return AgentController.runAgent(req, res);
  }
}