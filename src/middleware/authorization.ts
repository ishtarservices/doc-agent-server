import { Request, Response, NextFunction } from 'express';
import { MongoService } from '../services/mongoService';
import { AuthenticatedRequest } from './auth';

// Create service instance on-demand to avoid initialization timing issues
const getMongoService = () => new MongoService();

// Authorization middleware for organization access
export const requireOrganizationAccess = (requiredRoles: string[] = []) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          error: 'Organization ID is required',
        });
      }

      const mongoService = getMongoService();
      const organization = await mongoService.getOrganization(organizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      // Check if user is a member of the organization
      const membership = organization.members.find(member => member.userId === userId);

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a member of this organization',
        });
      }

      // Check role requirements if specified
      if (requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
        return res.status(403).json({
          success: false,
          error: `Access denied: Required role(s): ${requiredRoles.join(', ')}`,
        });
      }

      // Add organization and membership info to request
      req.organization = organization;
      req.organizationMembership = membership;

      next();
    } catch (error) {
      console.error('Organization authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

// Authorization middleware for project access
export const requireProjectAccess = (requiredRoles: string[] = []) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      const mongoService = getMongoService();
      const project = await mongoService.getProject(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      // Get organization to check membership
      const organization = await mongoService.getOrganization(project.organizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      // Check organization membership first
      const orgMembership = organization.members.find(member => member.userId === userId);

      if (!orgMembership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a member of the organization',
        });
      }

      // Check project-specific membership
      const projectMembership = project.members.find(member => member.userId === userId);

      // If project visibility is private, user must be a project member
      if (project.visibility === 'private' && !projectMembership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: This project is private',
        });
      }

      // Check role requirements if specified
      if (requiredRoles.length > 0) {
        const userRole = projectMembership?.role || 'viewer';
        if (!requiredRoles.includes(userRole)) {
          return res.status(403).json({
            success: false,
            error: `Access denied: Required role(s): ${requiredRoles.join(', ')}`,
          });
        }
      }

      // Add project, organization, and membership info to request
      req.project = project;
      req.organization = organization;
      req.organizationMembership = orgMembership;
      req.projectMembership = projectMembership;

      next();
    } catch (error) {
      console.error('Project authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

// Authorization middleware for task access
export const requireTaskAccess = (requiredRoles: string[] = []) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { taskId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'Task ID is required',
        });
      }

      const mongoService = getMongoService();
      const task = await mongoService.getTask(taskId);

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      // Get project and organization
      const project = await mongoService.getProject(task.projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      const organization = await mongoService.getOrganization(project.organizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      // Check organization membership
      const orgMembership = organization.members.find(member => member.userId === userId);

      if (!orgMembership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a member of the organization',
        });
      }

      // Check project access
      const projectMembership = project.members.find(member => member.userId === userId);

      if (project.visibility === 'private' && !projectMembership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: This project is private',
        });
      }

      // Check role requirements if specified
      if (requiredRoles.length > 0) {
        const userRole = projectMembership?.role || 'viewer';
        if (!requiredRoles.includes(userRole)) {
          return res.status(403).json({
            success: false,
            error: `Access denied: Required role(s): ${requiredRoles.join(', ')}`,
          });
        }
      }

      // Add task, project, organization, and membership info to request
      req.task = task;
      req.project = project;
      req.organization = organization;
      req.organizationMembership = orgMembership;
      req.projectMembership = projectMembership;

      next();
    } catch (error) {
      console.error('Task authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

// Authorization middleware for column access
export const requireColumnAccess = (requiredRoles: string[] = []) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { columnId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!columnId) {
        return res.status(400).json({
          success: false,
          error: 'Column ID is required',
        });
      }

      const mongoService = getMongoService();
      const column = await mongoService.getColumn(columnId);

      if (!column) {
        return res.status(404).json({
          success: false,
          error: 'Column not found',
        });
      }

      // Get project and organization
      const project = await mongoService.getProject(column.projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      const organization = await mongoService.getOrganization(project.organizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      // Check organization membership
      const orgMembership = organization.members.find(member => member.userId === userId);

      if (!orgMembership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a member of the organization',
        });
      }

      // Check project access
      const projectMembership = project.members.find(member => member.userId === userId);

      if (project.visibility === 'private' && !projectMembership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: This project is private',
        });
      }

      // Check column visibility
      if (column.visibility === 'private' && column.createdBy !== userId && !projectMembership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: This column is private',
        });
      }

      // Check role requirements if specified
      if (requiredRoles.length > 0) {
        const userRole = projectMembership?.role || 'viewer';
        if (!requiredRoles.includes(userRole)) {
          return res.status(403).json({
            success: false,
            error: `Access denied: Required role(s): ${requiredRoles.join(', ')}`,
          });
        }
      }

      // Add column, project, organization, and membership info to request
      req.column = column;
      req.project = project;
      req.organization = organization;
      req.organizationMembership = orgMembership;
      req.projectMembership = projectMembership;

      next();
    } catch (error) {
      console.error('Column authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};

// Authorization middleware for agent access
export const requireAgentAccess = (requiredRoles: string[] = []) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: 'Agent ID is required',
        });
      }

      const mongoService = getMongoService();
      const agent = await mongoService.getAgent(agentId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      // If agent is public, allow access for authenticated users
      if (agent.isPublic) {
        req.agent = agent;
        return next();
      }

      // For private agents, check organization membership
      const organization = await mongoService.getOrganization(agent.organizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      // Check organization membership
      const orgMembership = organization.members.find(member => member.userId === userId);

      if (!orgMembership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a member of the organization',
        });
      }

      // Check role requirements if specified
      if (requiredRoles.length > 0 && !requiredRoles.includes(orgMembership.role)) {
        return res.status(403).json({
          success: false,
          error: `Access denied: Required role(s): ${requiredRoles.join(', ')}`,
        });
      }

      // Add agent, organization, and membership info to request
      req.agent = agent;
      req.organization = organization;
      req.organizationMembership = orgMembership;

      next();
    } catch (error) {
      console.error('Agent authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
};