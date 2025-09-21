import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';

export interface LogContext {
  requestId: string;
  userId?: string;
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
  timestamp: string;
}

export class Logger {
  private static generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private static createContext(req: Request | AuthenticatedRequest): LogContext {
    const requestId = (req as any).requestId || Logger.generateRequestId();
    (req as any).requestId = requestId;

    return {
      requestId,
      userId: (req as AuthenticatedRequest).user?.id,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    };
  }

  static info(message: string, req?: Request | AuthenticatedRequest, data?: any) {
    const context = req ? Logger.createContext(req) : null;
    const logData = {
      level: 'INFO',
      message,
      context,
      data,
      timestamp: new Date().toISOString(),
    };
    // console.log('📝 INFO:', JSON.stringify(logData, null, 2));
  }

  static warn(message: string, req?: Request | AuthenticatedRequest, data?: any) {
    const context = req ? Logger.createContext(req) : null;
    const logData = {
      level: 'WARN',
      message,
      context,
      data,
      timestamp: new Date().toISOString(),
    };
    console.warn('⚠️ WARN:', JSON.stringify(logData, null, 2));
  }

  static error(message: string, req?: Request | AuthenticatedRequest, error?: any, data?: any) {
    const context = req ? Logger.createContext(req) : null;
    const logData = {
      level: 'ERROR',
      message,
      context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      data,
      timestamp: new Date().toISOString(),
    };
    console.error('🚨 ERROR:', JSON.stringify(logData, null, 2));
  }

  static auth(message: string, req: AuthenticatedRequest, data?: any) {
    const context = Logger.createContext(req);
    const logData = {
      level: 'AUTH',
      message,
      context,
      data: {
        ...data,
        hasAuthHeader: !!req.headers.authorization,
        authHeaderPrefix: req.headers.authorization?.substring(0, 10) + '...',
        tokenLength: req.accessToken?.length,
      },
      timestamp: new Date().toISOString(),
    };
    // console.log('🔐 AUTH:', JSON.stringify(logData, null, 2));
  }

  static authz(message: string, req: AuthenticatedRequest, data?: any) {
    const context = Logger.createContext(req);
    const logData = {
      level: 'AUTHZ',
      message,
      context,
      data: {
        ...data,
        params: req.params,
        hasUser: !!req.user,
        hasOrganization: !!req.organization,
        hasProject: !!req.project,
        organizationMembership: req.organizationMembership ? {
          role: req.organizationMembership.role,
          permissions: req.organizationMembership.permissions,
        } : null,
        projectMembership: req.projectMembership ? {
          role: req.projectMembership.role,
        } : null,
      },
      timestamp: new Date().toISOString(),
    };
    // console.log('🛡️ AUTHZ:', JSON.stringify(logData, null, 2));
  }

  static api(message: string, req: Request | AuthenticatedRequest, res?: Response, data?: any) {
    const context = Logger.createContext(req);
    const logData = {
      level: 'API',
      message,
      context,
      data: {
        ...data,
        body: req.method !== 'GET' ? req.body : undefined,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        params: Object.keys(req.params).length > 0 ? req.params : undefined,
        statusCode: res?.statusCode,
      },
      timestamp: new Date().toISOString(),
    };
    console.log('🌐 API:', JSON.stringify(logData, null, 2));
  }

  static db(message: string, req?: Request | AuthenticatedRequest, data?: any) {
    const context = req ? Logger.createContext(req) : null;
    const logData = {
      level: 'DB',
      message,
      context,
      data,
      timestamp: new Date().toISOString(),
    };
    // console.log('💾 DB:', JSON.stringify(logData, null, 2));
  }
}