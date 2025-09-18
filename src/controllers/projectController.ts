import { Response } from 'express';
import { MongoService } from '../services/mongoService';
import { AuthenticatedRequest } from '../middleware/auth';
import { Logger } from '../utils/logger';
import type {
  ProjectData,
  ProjectContext,
  CreateProjectRequest,
  UpdateProjectRequest,
  ApiResponse,
} from '../types';

// Create service instance on-demand to avoid initialization timing issues
const getMongoService = () => new MongoService();

export class ProjectController {
  static async getProject(req: AuthenticatedRequest, res: Response<ApiResponse<ProjectData>>) {
    try {
      // Project data is already validated and attached by authorization middleware
      if (!req.project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      res.json({
        success: true,
        data: req.project,
      });
    } catch (error) {
      console.error('Get Project Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getCurrentProjectContext(req: AuthenticatedRequest, res: Response<ApiResponse<ProjectContext>>) {
    try {
      const { projectId } = req.params;
      const mongoService = getMongoService();

      Logger.api('📂 Getting project context', req, undefined, {
        projectId,
        userId: req.user?.id,
        hasProjectAttached: !!req.project,
        hasOrganizationAttached: !!req.organization,
        userOrgRole: req.organizationMembership?.role,
        userProjectRole: req.projectMembership?.role,
      });

      Logger.db('💾 Fetching full project context from database', req, { projectId });

      // Project access is already validated by authorization middleware
      const context = await mongoService.getProjectContext(projectId);
      if (!context) {
        Logger.api('❌ Project context not found', req, res, { projectId });
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      Logger.api('✅ Project context retrieved successfully', req, res, {
        projectId: context.project._id,
        projectName: context.project.name,
        organizationId: context.organization._id,
        organizationName: context.organization.name,
        tasksCount: context.tasks.length,
        columnsCount: context.columns.length,
        agentsCount: context.agents.length,
        membersCount: context.members.length,
        projectVisibility: context.project.visibility,
        userAccess: {
          organizationRole: req.organizationMembership?.role,
          projectRole: req.projectMembership?.role || 'viewer',
        }
      });

      res.json({
        success: true,
        data: context,
      });
    } catch (error) {
      Logger.error('💥 Get Project Context Error', req, error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project context',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async createProject(req: AuthenticatedRequest, res: Response<ApiResponse<ProjectData>>) {
    try {
      const createData: CreateProjectRequest = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      Logger.api('📂 Creating project', req, undefined, {
        requestBody: req.body,
        userId,
        organizationId: createData.organizationId,
        projectName: createData.name,
      });

      const projectData = {
        ...createData,
        settings: {
          autoRunEnabled: true,
          aiModel: 'claude-3-5-sonnet',
          tokenBudget: 10000,
          ...createData.settings,
        },
        // Don't set members here - MongoService handles this with the createdBy parameter
        // Don't set createdBy, isActive, isArchived - MongoService handles these
      };

      Logger.db('💾 Creating project in database', req, {
        projectName: projectData.name,
        organizationId: projectData.organizationId,
        ownerUserId: userId,
        visibility: projectData.visibility,
        settings: projectData.settings,
      });

      const newProject = await mongoService.createProject(projectData, userId);

      Logger.db('📋 Creating default columns for project', req, {
        projectId: newProject._id,
        columnsToCreate: 4,
      });

      // Create default columns for the project
      const defaultColumns = [
        { title: 'Backlog', name: 'backlog', color: '#6b7280', position: 0 },
        { title: 'Sprint Ready', name: 'ready', color: '#3b82f6', position: 1 },
        { title: 'In Progress', name: 'in_progress', color: '#f59e0b', position: 2 },
        { title: 'Done', name: 'done', color: '#10b981', position: 3 },
      ];

      for (const columnData of defaultColumns) {
        await mongoService.createColumn({
          projectId: newProject._id,
          title: columnData.title,
          name: columnData.name,
          color: columnData.color,
          position: columnData.position,
          settings: {
            isCollapsed: false,
            isPinned: false,
            autoRun: false,
            taskLimit: 50,
          },
          visibility: 'public',
          createdBy: userId,
        });
      }

      Logger.api('✅ Project created successfully with default columns', req, res, {
        projectId: newProject._id,
        projectName: newProject.name,
        organizationId: newProject.organizationId,
        visibility: newProject.visibility,
        membersCount: newProject.members.length,
        columnsCreated: defaultColumns.length,
      });

      res.status(201).json({
        success: true,
        data: newProject,
      });
    } catch (error) {
      Logger.error('💥 Create Project Error', req, error);
      res.status(500).json({
        success: false,
        error: 'Failed to create project',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async updateProject(req: AuthenticatedRequest, res: Response<ApiResponse<ProjectData>>) {
    try {
      const { projectId } = req.params;
      const updates: UpdateProjectRequest = req.body;
      const mongoService = getMongoService();

      // Project access is already validated by authorization middleware
      // Check if user has editor or owner role
      const userRole = req.projectMembership?.role || 'viewer';
      if (!['owner', 'editor'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Editor or owner role required to update project',
        });
      }

      const updatedProject = await mongoService.updateProject(projectId, updates);
      if (!updatedProject) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      res.json({
        success: true,
        data: updatedProject,
      });
    } catch (error) {
      console.error('Update Project Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update project',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async deleteProject(req: AuthenticatedRequest, res: Response<ApiResponse<void>>) {
    try {
      const { projectId } = req.params;
      const mongoService = getMongoService();

      // Project access is already validated by authorization middleware
      // Only owners can delete projects
      const userRole = req.projectMembership?.role || 'viewer';
      if (userRole !== 'owner') {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Owner role required to delete project',
        });
      }

      const deleted = await mongoService.deleteProject(projectId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      res.json({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error) {
      console.error('Delete Project Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete project',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getProjectsByOrganization(req: AuthenticatedRequest, res: Response<ApiResponse<ProjectData[]>>) {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.id;
      const mongoService = getMongoService();

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      // Use user-scoped method to get only projects user has access to
      const projects = await mongoService.getProjectsByOrganizationForUser(organizationId, userId);

      res.json({
        success: true,
        data: projects,
      });
    } catch (error) {
      console.error('Get Projects by Organization Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get projects',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getProjectTasks(req: AuthenticatedRequest, res: Response<ApiResponse<any[]>>) {
    try {
      const { projectId } = req.params;
      const { status } = req.query;
      const mongoService = getMongoService();

      // Project access is already validated by authorization middleware
      let tasks;
      if (status) {
        tasks = await mongoService.getTasksByProjectAndStatus(projectId, status as string);
      } else {
        tasks = await mongoService.getTasksByProject(projectId);
      }

      res.json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      console.error('Get Project Tasks Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project tasks',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getProjectColumns(req: AuthenticatedRequest, res: Response<ApiResponse<any[]>>) {
    try {
      const { projectId } = req.params;
      const mongoService = getMongoService();

      // Project access is already validated by authorization middleware
      const columns = await mongoService.getColumnsByProject(projectId);

      res.json({
        success: true,
        data: columns,
      });
    } catch (error) {
      console.error('Get Project Columns Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project columns',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}