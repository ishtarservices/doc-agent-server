import { Response } from 'express';
import { MongoService } from '../services/mongoService';
import { AuthenticatedRequest } from '../middleware/auth';
import type {
  OrganizationData,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  ApiResponse,
} from '../types';

// Create service instance on-demand to avoid initialization timing issues
const getMongoService = () => new MongoService();

export class OrganizationController {
  static async getOrganization(req: AuthenticatedRequest, res: Response<ApiResponse<OrganizationData>>) {
    try {
      // Organization data is already validated and attached by authorization middleware
      if (!req.organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      res.json({
        success: true,
        data: req.organization,
      });
    } catch (error) {
      console.error('Get Organization Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get organization',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async createOrganization(req: AuthenticatedRequest, res: Response<ApiResponse<OrganizationData>>) {
    try {
      const createData: CreateOrganizationRequest = req.body;
      const userId = req.user?.id || 'default-user';
      const mongoService = getMongoService();

      const organizationData = {
        ...createData,
        settings: {
          defaultColumns: ['backlog', 'ready', 'in_progress', 'done'],
          aiCredits: 10000,
          maxProjects: 10,
          features: ['ai_agents', 'auto_run', 'basic_analytics'],
        },
        members: [{
          userId,
          role: 'owner' as const,
          joinedAt: new Date(),
          permissions: ['*'],
        }],
        isActive: true,
      };

      const newOrganization = await mongoService.createOrganization(organizationData, userId);

      res.status(201).json({
        success: true,
        data: newOrganization,
      });
    } catch (error) {
      console.error('Create Organization Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create organization',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async updateOrganization(req: AuthenticatedRequest, res: Response<ApiResponse<OrganizationData>>) {
    try {
      const { organizationId } = req.params;
      const updates: UpdateOrganizationRequest = req.body;
      const mongoService = getMongoService();

      // Organization access is already validated by authorization middleware
      // Check if user has admin or owner role
      if (!req.organizationMembership || !['owner', 'admin'].includes(req.organizationMembership.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Owner or admin role required to update organization',
        });
      }

      const updatedOrganization = await mongoService.updateOrganization(organizationId, updates);
      if (!updatedOrganization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      res.json({
        success: true,
        data: updatedOrganization,
      });
    } catch (error) {
      console.error('Update Organization Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update organization',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async deleteOrganization(req: AuthenticatedRequest, res: Response<ApiResponse<void>>) {
    try {
      const { organizationId } = req.params;
      const mongoService = getMongoService();

      // Organization access is already validated by authorization middleware
      // Only owners can delete organizations
      if (!req.organizationMembership || req.organizationMembership.role !== 'owner') {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Owner role required to delete organization',
        });
      }

      const deleted = await mongoService.deleteOrganization(organizationId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      res.json({
        success: true,
        message: 'Organization deleted successfully',
      });
    } catch (error) {
      console.error('Delete Organization Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete organization',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getAIUsage(req: AuthenticatedRequest, res: Response<ApiResponse<{
    tokensUsed: number;
    tokensRemaining: number;
    lastResetDate: Date;
  }>>) {
    try {
      // Organization data is already validated and attached by authorization middleware
      if (!req.organization) {
        return res.status(404).json({
          success: false,
          error: 'Organization not found',
        });
      }

      // TODO: Implement actual usage tracking
      // For now, return placeholder data
      res.json({
        success: true,
        data: {
          tokensUsed: 5000,
          tokensRemaining: req.organization.settings.aiCredits - 5000,
          lastResetDate: new Date(),
        },
      });
    } catch (error) {
      console.error('Get AI Usage Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get AI usage',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  static async getOrganizationsByUser(req: AuthenticatedRequest, res: Response<ApiResponse<OrganizationData[]>>) {
    try {
      const userId = req.user?.id;
      const mongoService = getMongoService();

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
      }

      const organizations = await mongoService.getOrganizationsByUser(userId);

      res.json({
        success: true,
        data: organizations,
      });
    } catch (error) {
      console.error('Get User Organizations Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user organizations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}