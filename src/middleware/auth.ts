import { Request, Response, NextFunction } from 'express';
import { createUserSupabaseClient } from '../config/supabase';
import { Logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
  accessToken?: string;
  // Authorization context added by authorization middleware
  organization?: any;
  project?: any;
  task?: any;
  column?: any;
  agent?: any;
  organizationMembership?: any;
  projectMembership?: any;
}

export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    Logger.auth('🚀 Starting authentication', req, {
      hasAuthHeader: !!req.headers.authorization,
      authHeaderLength: req.headers.authorization?.length,
      contentType: req.get('Content-Type'),
    });

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      Logger.auth('❌ Missing or invalid authorization header', req, {
        authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : 'none',
        hasBearer: authHeader?.startsWith('Bearer '),
      });

      return res.status(401).json({
        error: 'Missing or invalid authorization header',
        message: 'Please provide a valid Bearer token'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    req.accessToken = token;

    Logger.auth('🔑 Extracted token', req, {
      tokenLength: token.length,
      tokenPrefix: `${token.substring(0, 10)}...`,
      tokenSuffix: `...${token.substring(token.length - 10)}`,
    });

    // Verify the token with Supabase
    const supabaseClient = createUserSupabaseClient(token);
    Logger.auth('🔍 Verifying token with Supabase', req);

    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      Logger.auth('❌ Token verification failed', req, {
        error: error?.message,
        hasUser: !!user,
        supabaseError: error,
      });

      return res.status(401).json({
        error: 'Invalid token',
        message: 'Please log in again'
      });
    }

    Logger.auth('✅ Token verified successfully', req, {
      userId: user.id,
      userEmail: user.email,
      userMetadata: {
        hasEmail: !!user.email,
        emailVerified: user.email_confirmed_at !== null,
        lastSignIn: user.last_sign_in_at,
        createdAt: user.created_at,
      }
    });

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
    };

    Logger.auth('🎯 Authentication complete', req, {
      userAttached: !!req.user,
      userId: req.user.id,
    });

    next();
  } catch (error) {
    Logger.error('💥 Authentication middleware error', req, error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};