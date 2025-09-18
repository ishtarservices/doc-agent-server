import { MongoService } from '../services/mongoService';
import type { OrganizationData, ProjectData, TaskData, AgentData, ColumnData } from '../types';

// Create service instance on-demand to avoid initialization timing issues
const getMongoService = () => new MongoService();

/**
 * Authorization utility functions for checking user permissions
 */
export class AuthorizationUtils {
  /**
   * Check if user has access to an organization
   */
  static async hasOrganizationAccess(
    organizationId: string,
    userId: string,
    requiredRoles: string[] = []
  ): Promise<{ hasAccess: boolean; role?: string; organization?: OrganizationData }> {
    try {
      const mongoService = getMongoService();
      const organization = await mongoService.getOrganization(organizationId);

      if (!organization) {
        return { hasAccess: false };
      }

      const membership = organization.members.find(member => member.userId === userId);

      if (!membership) {
        return { hasAccess: false, organization };
      }

      // Check role requirements if specified
      if (requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
        return { hasAccess: false, role: membership.role, organization };
      }

      return { hasAccess: true, role: membership.role, organization };
    } catch (error) {
      console.error('Organization access check error:', error);
      return { hasAccess: false };
    }
  }

  /**
   * Check if user has access to a project
   */
  static async hasProjectAccess(
    projectId: string,
    userId: string,
    requiredRoles: string[] = []
  ): Promise<{
    hasAccess: boolean;
    role?: string;
    project?: ProjectData;
    organization?: OrganizationData;
  }> {
    try {
      const mongoService = getMongoService();
      const project = await mongoService.getProject(projectId);

      if (!project) {
        return { hasAccess: false };
      }

      // Check organization access first
      const orgCheck = await this.hasOrganizationAccess(project.organizationId, userId);
      if (!orgCheck.hasAccess) {
        return { hasAccess: false, project, organization: orgCheck.organization };
      }

      // Check project-specific access
      const projectMembership = project.members.find(member => member.userId === userId);

      // If project is private, user must be a project member
      if (project.visibility === 'private' && !projectMembership) {
        return { hasAccess: false, project, organization: orgCheck.organization };
      }

      // Determine user role (project role takes precedence, then org role)
      const userRole = projectMembership?.role || 'viewer';

      // Check role requirements if specified
      if (requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
        return { hasAccess: false, role: userRole, project, organization: orgCheck.organization };
      }

      return {
        hasAccess: true,
        role: userRole,
        project,
        organization: orgCheck.organization,
      };
    } catch (error) {
      console.error('Project access check error:', error);
      return { hasAccess: false };
    }
  }

  /**
   * Check if user has access to a task
   */
  static async hasTaskAccess(
    taskId: string,
    userId: string,
    requiredRoles: string[] = []
  ): Promise<{
    hasAccess: boolean;
    role?: string;
    task?: TaskData;
    project?: ProjectData;
    organization?: OrganizationData;
  }> {
    try {
      const mongoService = getMongoService();
      const task = await mongoService.getTask(taskId);

      if (!task) {
        return { hasAccess: false };
      }

      // Check project access (which includes organization access)
      const projectCheck = await this.hasProjectAccess(task.projectId, userId, requiredRoles);

      return {
        hasAccess: projectCheck.hasAccess,
        role: projectCheck.role,
        task,
        project: projectCheck.project,
        organization: projectCheck.organization,
      };
    } catch (error) {
      console.error('Task access check error:', error);
      return { hasAccess: false };
    }
  }

  /**
   * Check if user has access to an agent
   */
  static async hasAgentAccess(
    agentId: string,
    userId: string,
    requiredRoles: string[] = []
  ): Promise<{
    hasAccess: boolean;
    role?: string;
    agent?: AgentData;
    organization?: OrganizationData;
  }> {
    try {
      const mongoService = getMongoService();
      const agent = await mongoService.getAgent(agentId);

      if (!agent) {
        return { hasAccess: false };
      }

      // If agent is public, allow access for authenticated users
      if (agent.isPublic) {
        return { hasAccess: true, agent };
      }

      // For private agents, check organization membership
      const orgCheck = await this.hasOrganizationAccess(agent.organizationId, userId, requiredRoles);

      return {
        hasAccess: orgCheck.hasAccess,
        role: orgCheck.role,
        agent,
        organization: orgCheck.organization,
      };
    } catch (error) {
      console.error('Agent access check error:', error);
      return { hasAccess: false };
    }
  }

  /**
   * Check if user has access to a column
   */
  static async hasColumnAccess(
    columnId: string,
    userId: string,
    requiredRoles: string[] = []
  ): Promise<{
    hasAccess: boolean;
    role?: string;
    column?: ColumnData;
    project?: ProjectData;
    organization?: OrganizationData;
  }> {
    try {
      const mongoService = getMongoService();
      const column = await mongoService.getColumn(columnId);

      if (!column) {
        return { hasAccess: false };
      }

      // Check project access (which includes organization access)
      const projectCheck = await this.hasProjectAccess(column.projectId, userId, requiredRoles);

      if (!projectCheck.hasAccess) {
        return {
          hasAccess: false,
          column,
          project: projectCheck.project,
          organization: projectCheck.organization,
        };
      }

      // Check column-specific visibility
      if (column.visibility === 'private' && column.createdBy !== userId) {
        // Only the creator or project members can access private columns
        const projectMembership = projectCheck.project?.members.find(member => member.userId === userId);
        if (!projectMembership) {
          return {
            hasAccess: false,
            column,
            project: projectCheck.project,
            organization: projectCheck.organization,
          };
        }
      }

      return {
        hasAccess: true,
        role: projectCheck.role,
        column,
        project: projectCheck.project,
        organization: projectCheck.organization,
      };
    } catch (error) {
      console.error('Column access check error:', error);
      return { hasAccess: false };
    }
  }

  /**
   * Get all organizations user has access to
   */
  static async getUserOrganizations(userId: string): Promise<OrganizationData[]> {
    try {
      const mongoService = getMongoService();
      return await mongoService.getOrganizationsByUser(userId);
    } catch (error) {
      console.error('Get user organizations error:', error);
      return [];
    }
  }

  /**
   * Get all projects user has access to within an organization
   */
  static async getUserProjectsInOrganization(
    organizationId: string,
    userId: string
  ): Promise<ProjectData[]> {
    try {
      const mongoService = getMongoService();

      // First check if user has access to organization
      const orgCheck = await this.hasOrganizationAccess(organizationId, userId);
      if (!orgCheck.hasAccess) {
        return [];
      }

      return await mongoService.getProjectsByOrganizationForUser(organizationId, userId);
    } catch (error) {
      console.error('Get user projects in organization error:', error);
      return [];
    }
  }

  /**
   * Check if user can perform an action based on their role
   */
  static canPerformAction(userRole: string, requiredRoles: string[]): boolean {
    if (requiredRoles.length === 0) return true;
    return requiredRoles.includes(userRole);
  }

  /**
   * Get role hierarchy (higher index = more permissions)
   */
  static getRoleHierarchy(): string[] {
    return ['viewer', 'member', 'editor', 'admin', 'owner'];
  }

  /**
   * Check if user role has at least the required permission level
   */
  static hasMinimumRole(userRole: string, minimumRole: string): boolean {
    const hierarchy = this.getRoleHierarchy();
    const userIndex = hierarchy.indexOf(userRole);
    const requiredIndex = hierarchy.indexOf(minimumRole);

    return userIndex !== -1 && requiredIndex !== -1 && userIndex >= requiredIndex;
  }
}

export default AuthorizationUtils;