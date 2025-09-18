import { Response } from 'express';
import { MongoService } from '../services/mongoService';
import { AuthenticatedRequest } from '../middleware/auth';
import type {
  ColumnData,
  TaskData,
  CreateColumnRequest,
  UpdateColumnRequest,
  ApiResponse,
} from '../types';

// Create service instance on-demand to avoid initialization timing issues
const getMongoService = () => new MongoService();

export class ColumnController {
  static async getColumn(req: AuthenticatedRequest, res: Response<ApiResponse<ColumnData>>) {
    try {
      // Column data is already validated and attached by authorization middleware
      if (!req.column) {
        return res.status(404).json({
          success: false,
          error: 'Column not found',
        });
      }

      res.json({
        success: true,
        data: req.column,
      });
    } catch (error) {
      console.error('Get Column Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get column',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async createColumn(req: AuthenticatedRequest, res: Response<ApiResponse<ColumnData>>) {
    try {
      const createData: CreateColumnRequest = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      // Verify user has access to the project
      const hasProjectAccess = await mongoService.hasProjectAccess(createData.projectId, userId);
      if (!hasProjectAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not have access to this project',
        });
      }

      // Check if user has editor or owner role
      const project = await mongoService.getProject(createData.projectId);
      if (project) {
        const projectMembership = project.members.find(member => member.userId === userId);
        const userRole = projectMembership?.role || 'viewer';
        if (!['owner', 'editor'].includes(userRole)) {
          return res.status(403).json({
            success: false,
            error: 'Access denied: Editor or owner role required to create columns',
          });
        }
      }

      const columnData = {
        ...createData,
        settings: {
          isCollapsed: false,
          isPinned: false,
          autoRun: false,
          taskLimit: 50,
          ...createData.settings,
        },
        visibility: createData.visibility || 'public',
        createdBy: userId,
      };

      const newColumn = await mongoService.createColumn(columnData);

      res.status(201).json({
        success: true,
        data: newColumn,
      });
    } catch (error) {
      console.error('Create Column Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create column',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async updateColumn(req: AuthenticatedRequest, res: Response<ApiResponse<ColumnData>>) {
    try {
      const { columnId } = req.params;
      const updates: UpdateColumnRequest = req.body;
      const mongoService = getMongoService();

      // Column access is already validated by authorization middleware
      // Check if user has editor or owner role in the project
      const userRole = req.projectMembership?.role || 'viewer';
      if (!['owner', 'editor'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Editor or owner role required to update columns',
        });
      }

      const updatedColumn = await mongoService.updateColumn(columnId, updates);
      if (!updatedColumn) {
        return res.status(404).json({
          success: false,
          error: 'Column not found',
        });
      }

      res.json({
        success: true,
        data: updatedColumn,
      });
    } catch (error) {
      console.error('Update Column Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update column',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async deleteColumn(req: AuthenticatedRequest, res: Response<ApiResponse<void>>) {
    try {
      const { columnId } = req.params;
      const mongoService = getMongoService();

      // Column access is already validated by authorization middleware
      // Check if user has editor or owner role in the project
      const userRole = req.projectMembership?.role || 'viewer';
      if (!['owner', 'editor'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Editor or owner role required to delete columns',
        });
      }

      const deleted = await mongoService.deleteColumn(columnId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Column not found',
        });
      }

      res.json({
        success: true,
        message: 'Column deleted successfully',
      });
    } catch (error) {
      console.error('Delete Column Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete column',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getColumnTasks(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData[]>>) {
    try {
      const { columnId } = req.params;
      const mongoService = getMongoService();

      // Column access is already validated by authorization middleware
      const tasks = await mongoService.getTasksByColumn(columnId);

      res.json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      console.error('Get Column Tasks Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get column tasks',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}