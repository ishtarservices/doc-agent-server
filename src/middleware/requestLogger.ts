import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { Logger } from '../utils/logger';

export const logAllRequests = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Generate unique request ID
  (req as any).requestId = Math.random().toString(36).substring(2, 15);

  // Log the incoming request
  Logger.info('🌐 Incoming Request', req, {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    authorization: req.headers.authorization ?
      `${req.headers.authorization.substring(0, 20)}...` : 'none',
    params: Object.keys(req.params).length > 0 ? req.params : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    body: req.method !== 'GET' && req.body ? {
      hasBody: true,
      bodyKeys: typeof req.body === 'object' ? Object.keys(req.body) : 'non-object',
      bodySize: JSON.stringify(req.body).length,
    } : undefined,
  });

  // Capture the original response methods
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;

  let responseBody: any = null;
  let statusCode = 200;

  // Override status method to capture status codes
  res.status = function(code: number) {
    statusCode = code;
    return originalStatus.call(this, code);
  };

  // Override send method to capture response
  res.send = function(body: any) {
    responseBody = body;
    logResponse();
    return originalSend.call(this, body);
  };

  // Override json method to capture JSON responses
  res.json = function(body: any) {
    responseBody = body;
    logResponse();
    return originalJson.call(this, body);
  };

  function logResponse() {
    const duration = Date.now() - startTime;
    const isError = statusCode >= 400;
    const logLevel = isError ? 'error' : 'info';

    // Parse response for logging
    let responseInfo: any = {
      statusCode,
      duration: `${duration}ms`,
      hasResponseBody: !!responseBody,
    };

    if (responseBody) {
      try {
        const parsed = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
        responseInfo.responseType = parsed.success !== undefined ? 'api' : 'raw';
        responseInfo.success = parsed.success;
        responseInfo.error = parsed.error;
        responseInfo.dataType = parsed.data ? typeof parsed.data : undefined;
        responseInfo.responseSize = JSON.stringify(responseBody).length;
      } catch (e) {
        responseInfo.responseType = 'raw';
        responseInfo.responseSize = responseBody.length || 0;
      }
    }

    if (isError) {
      Logger.error('🚨 Request Failed', req, null, responseInfo);
    } else {
      Logger.info('✅ Request Completed', req, responseInfo);
    }
  }

  next();
};

// Middleware to log route-specific information
export const logRoute = (routeName: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Logger.info(`🛣️ Route: ${routeName}`, req, {
      route: routeName,
      method: req.method,
      params: req.params,
      hasUser: !!req.user,
      userId: req.user?.id,
      hasOrganization: !!req.organization,
      hasProject: !!req.project,
      hasTask: !!req.task,
      userRoles: {
        organization: req.organizationMembership?.role,
        project: req.projectMembership?.role,
      }
    });
    next();
  };
};