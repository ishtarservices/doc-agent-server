import { Request, Response, NextFunction } from 'express';
import { createUserSupabaseClient } from '../config/supabase';

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
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or invalid authorization header',
        message: 'Please provide a valid Bearer token'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    req.accessToken = token;

    // Verify the token with Supabase
    const supabaseClient = createUserSupabaseClient(token);
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      console.error('Authentication error:', error);
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Please log in again'
      });
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
};