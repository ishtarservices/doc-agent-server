import { Request, Response, NextFunction } from 'express';
import { MongoService } from '../services/mongoService';
import { AuthenticatedRequest } from './auth';
import { Logger } from '../utils/logger';

// Create service instance on-demand to avoid initialization timing issues
const getMongoService = () => new MongoService();

// Authorization middleware for organization access
export const requireOrganizationAccess = (requiredRoles: string[] = []) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.params;
      const userId = req.user?.id;

      Logger.authz('🏢 Starting organization access check', req, {
        organizationId,
        userId,
        requiredRoles,
        params: req.params,
      });

      if (!userId) {
        Logger.authz('❌ User not authenticated for organization access', req);
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!organizationId) {
        Logger.authz('❌ Organization ID missing from request', req, {
          params: req.params,
          originalUrl: req.originalUrl,
        });
        return res.status(400).json({
          success: false,
          error: 'Organization ID is required',
        });
      }

      Logger.authz('🔍 Fetching organization from database', req, { organizationId });
      const mongoService = getMongoService();
      const organization = await mongoService.getOrganization(organizationId);

      if (!organization) {
        Logger.authz('❌ Organization not found in database', req, { organizationId });
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      Logger.authz('📋 Organization found, checking membership', req, {
        organizationId: organization._id,
        organizationName: organization.name,
        organizationMembersCount: organization.members.length,
        organizationMembers: organization.members.map(m => ({ userId: m.userId, role: m.role })),
        seekingUserId: userId,
      });

      // Check if user is a member of the organization
      const membership = organization.members.find(member => member.userId === userId);

      if (!membership) {
        Logger.authz('❌ User not a member of organization', req, {
          userId,
          organizationId,
          organizationMembers: organization.members.map(m => m.userId),
          membershipFound: false,
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a member of this organization',
        });
      }

      Logger.authz('✅ User membership found', req, {
        userId,
        membershipRole: membership.role,
        membershipJoinedAt: membership.joinedAt,
        membershipPermissions: membership.permissions,
        requiredRoles,
      });

      // Check role requirements if specified
      if (requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
        Logger.authz('❌ Insufficient role permissions', req, {
          userRole: membership.role,
          requiredRoles,
          roleMatches: requiredRoles.includes(membership.role),
        });
        return res.status(403).json({
          success: false,
          error: `Access denied: Required role(s): ${requiredRoles.join(', ')}`,
        });
      }

      // Add organization and membership info to request
      req.organization = organization;
      req.organizationMembership = membership;

      Logger.authz('🎯 Organization access granted', req, {
        organizationId: organization._id,
        organizationName: organization.name,
        userRole: membership.role,
        accessLevel: 'organization',
      });

      next();
    } catch (error) {
      Logger.error('💥 Organization authorization error', req, error);
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

      Logger.authz('📂 Starting project access check', req, {
        projectId,
        userId,
        requiredRoles,
        params: req.params,
      });

      if (!userId) {
        Logger.authz('❌ User not authenticated for project access', req);
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      if (!projectId) {
        Logger.authz('❌ Project ID missing from request', req, {
          params: req.params,
          originalUrl: req.originalUrl,
        });
        return res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
      }

      Logger.authz('🔍 Fetching project from database', req, { projectId });
      const mongoService = getMongoService();
      const project = await mongoService.getProject(projectId);

      if (!project) {
        Logger.authz('❌ Project not found in database', req, { projectId });
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      Logger.authz('📋 Project found, fetching organization', req, {
        projectId: project._id,
        projectName: project.name,
        projectOrganizationId: project.organizationId,
        projectVisibility: project.visibility,
        projectMembersCount: project.members.length,
        projectMembers: project.members.map(m => ({ userId: m.userId, role: m.role })),
      });

      // Get organization to check membership
      const organization = await mongoService.getOrganization(project.organizationId);

      if (!organization) {
        Logger.authz('❌ Organization not found for project', req, {
          projectId,
          organizationId: project.organizationId,
        });
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      Logger.authz('🏢 Organization found, checking memberships', req, {
        organizationId: organization._id,
        organizationName: organization.name,
        organizationMembersCount: organization.members.length,
        organizationMembers: organization.members.map(m => ({ userId: m.userId, role: m.role })),
        seekingUserId: userId,
      });

      // Check organization membership first
      const orgMembership = organization.members.find(member => member.userId === userId);

      if (!orgMembership) {
        Logger.authz('❌ User not a member of project organization', req, {
          userId,
          organizationId: organization._id,
          organizationMembers: organization.members.map(m => m.userId),
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a member of the organization',
        });
      }

      Logger.authz('✅ Organization membership confirmed', req, {
        userId,
        organizationRole: orgMembership.role,
        organizationPermissions: orgMembership.permissions,
      });

      // Check project-specific membership
      const projectMembership = project.members.find(member => member.userId === userId);

      Logger.authz('🔍 Checking project-specific access', req, {
        projectVisibility: project.visibility,
        hasProjectMembership: !!projectMembership,
        projectMembershipRole: projectMembership?.role,
        requiredRoles,
      });

      // If project visibility is private, user must be a project member
      if (project.visibility === 'private' && !projectMembership) {
        Logger.authz('❌ Private project access denied - no project membership', req, {
          projectVisibility: project.visibility,
          hasProjectMembership: false,
          userId,
          projectMembers: project.members.map(m => m.userId),
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied: This project is private',
        });
      }

      // Check role requirements if specified
      if (requiredRoles.length > 0) {
        const userRole = projectMembership?.role || 'viewer';
        Logger.authz('🔐 Checking role requirements', req, {
          userRole,
          requiredRoles,
          roleMatches: requiredRoles.includes(userRole),
          hasProjectMembership: !!projectMembership,
        });

        if (!requiredRoles.includes(userRole)) {
          Logger.authz('❌ Insufficient project role permissions', req, {
            userRole,
            requiredRoles,
            hasProjectMembership: !!projectMembership,
          });
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

      Logger.authz('🎯 Project access granted', req, {
        projectId: project._id,
        projectName: project.name,
        projectVisibility: project.visibility,
        organizationRole: orgMembership.role,
        projectRole: projectMembership?.role || 'viewer',
        accessLevel: 'project',
      });

      next();
    } catch (error) {
      Logger.error('💥 Project authorization error', req, error);
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