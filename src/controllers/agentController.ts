import { Response } from 'express';
import { MongoService } from '../services/mongoService';
import { AuthenticatedRequest } from '../middleware/auth';
import type {
  AgentData,
  TaskData,
  CreateAgentRequest,
  UpdateAgentRequest,
  AssignAgentRequest,
  RunAgentRequest,
  ApiResponse,
} from '../types';

// Create service instance on-demand to avoid initialization timing issues
const getMongoService = () => new MongoService();

export class AgentController {
  static async getAgent(req: AuthenticatedRequest, res: Response<ApiResponse<AgentData>>) {
    try {
      // Agent data is already validated and attached by authorization middleware
      if (!req.agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      res.json({
        success: true,
        data: req.agent,
      });
    } catch (error) {
      console.error('Get Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getAgentsByOrganization(req: AuthenticatedRequest, res: Response<ApiResponse<AgentData[]>>) {
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

      // Organization access is already validated by authorization middleware
      const agents = await mongoService.getAgentsByOrganization(organizationId);

      res.json({
        success: true,
        data: agents,
      });
    } catch (error) {
      console.error('Get Agents by Organization Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get agents',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async createAgent(req: AuthenticatedRequest, res: Response<ApiResponse<AgentData>>) {
    try {
      const createData: CreateAgentRequest = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      // Verify user has access to the organization
      const hasOrgAccess = await mongoService.hasOrganizationAccess(createData.organizationId, userId);
      if (!hasOrgAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You are not a member of this organization',
        });
      }

      // Check if user has admin or owner role in organization
      const organization = await mongoService.getOrganization(createData.organizationId);
      if (organization) {
        const membership = organization.members.find(member => member.userId === userId);
        if (!membership || !['owner', 'admin'].includes(membership.role)) {
          return res.status(403).json({
            success: false,
            error: 'Access denied: Admin or owner role required to create agents',
          });
        }
      }

      const agentData = {
        ...createData,
        settings: {
          maxTokens: 4000,
          temperature: 0.3,
          autoRun: false,
          retryAttempts: 2,
          timeout: 30,
          ...createData.settings,
        },
        capabilities: createData.capabilities || [],
        createdBy: userId,
        isActive: true,
        isPublic: createData.isPublic || false,
      };

      const newAgent = await mongoService.createAgent(agentData);

      res.status(201).json({
        success: true,
        data: newAgent,
      });
    } catch (error) {
      console.error('Create Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async updateAgent(req: AuthenticatedRequest, res: Response<ApiResponse<AgentData>>) {
    try {
      const { agentId } = req.params;
      const updates: UpdateAgentRequest = req.body;
      const mongoService = getMongoService();

      // Agent access is already validated by authorization middleware
      // Check if user has admin or owner role in organization
      if (!req.organizationMembership || !['owner', 'admin'].includes(req.organizationMembership.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Admin or owner role required to update agents',
        });
      }

      const updatedAgent = await mongoService.updateAgent(agentId, updates);
      if (!updatedAgent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      res.json({
        success: true,
        data: updatedAgent,
      });
    } catch (error) {
      console.error('Update Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async deleteAgent(req: AuthenticatedRequest, res: Response<ApiResponse<void>>) {
    try {
      const { agentId } = req.params;
      const mongoService = getMongoService();

      // Agent access is already validated by authorization middleware
      // Check if user has admin or owner role in organization
      if (!req.organizationMembership || !['owner', 'admin'].includes(req.organizationMembership.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Admin or owner role required to delete agents',
        });
      }

      const deleted = await mongoService.deleteAgent(agentId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      res.json({
        success: true,
        message: 'Agent deleted successfully',
      });
    } catch (error) {
      console.error('Delete Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async assignAgent(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData>>) {
    try {
      const { taskId } = req.params;
      const { agentId, autoRun }: { agentId: string; autoRun?: boolean } = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      // Task access is already validated by authorization middleware
      if (!req.task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      // Check if user has editor or owner role in the project
      const userRole = req.projectMembership?.role || 'viewer';
      if (!['owner', 'editor'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Editor or owner role required to assign agents',
        });
      }

      // Verify agent exists and user has access to it
      const agent = await mongoService.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      // Check if user has access to the agent (either public or same organization)
      if (!agent.isPublic) {
        const hasOrgAccess = await mongoService.hasOrganizationAccess(agent.organizationId, userId);
        if (!hasOrgAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied: You do not have access to this agent',
          });
        }
      }

      // Add to agent history
      const newAgentHistory = [...req.task.agentHistory, {
        agentId,
        assignedAt: new Date(),
        assignedBy: userId,
      }];

      // Update task with assigned agent
      const updatedTask = await mongoService.updateTask(taskId, {
        assignedAgent: agentId,
        agentHistory: newAgentHistory,
      });

      if (!updatedTask) {
        return res.status(500).json({
          success: false,
          error: 'Failed to assign agent to task',
        });
      }

      // Auto-run if requested
      if (autoRun) {
        // TODO: Implement actual agent execution
        console.log(`Auto-running agent ${agentId} for task ${taskId}`);
      }

      res.json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      console.error('Assign Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async runAgent(req: AuthenticatedRequest, res: Response<ApiResponse<TaskData>>) {
    try {
      const { taskId } = req.params;
      const { agentId, options }: RunAgentRequest = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      // Task access is already validated by authorization middleware
      if (!req.task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
        });
      }

      // Check if user has editor or owner role in the project
      const userRole = req.projectMembership?.role || 'viewer';
      if (!['owner', 'editor'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Editor or owner role required to run agents',
        });
      }

      // Use provided agentId or task's assigned agent
      const targetAgentId = agentId || req.task.assignedAgent;
      if (!targetAgentId) {
        return res.status(400).json({
          success: false,
          error: 'No agent specified and no agent assigned to task',
        });
      }

      // Verify agent exists and user has access to it
      const agent = await mongoService.getAgent(targetAgentId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
        });
      }

      // Check if user has access to the agent (either public or same organization)
      if (!agent.isPublic) {
        const hasOrgAccess = await mongoService.hasOrganizationAccess(agent.organizationId, userId);
        if (!hasOrgAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied: You do not have access to this agent',
          });
        }
      }

      // TODO: Implement actual agent execution logic
      // For now, simulate execution
      const mockResult = {
        success: true,
        output: 'Agent execution completed successfully (mock)',
        tokensUsed: Math.floor(Math.random() * 1000) + 500,
        executedAt: new Date(),
      };

      // Update agent history with result
      const updatedAgentHistory = req.task.agentHistory.map((history: any) => {
        if (history.agentId === targetAgentId && !history.result) {
          return { ...history, result: mockResult };
        }
        return history;
      });

      // Update task with execution results
      const updatedTask = await mongoService.updateTask(taskId, {
        agentHistory: updatedAgentHistory,
        actualTokensUsed: req.task.actualTokensUsed + mockResult.tokensUsed,
        lastAgentRun: new Date(),
        progressPercentage: Math.min(req.task.progressPercentage + 25, 100),
      });

      if (!updatedTask) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update task after agent run',
        });
      }

      res.json({
        success: true,
        data: updatedTask,
      });
    } catch (error) {
      console.error('Run Agent Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run agent',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}