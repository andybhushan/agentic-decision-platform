/**
 * Simple authentication routes for demo session-based auth.
 * POST /api/auth/login - login with password
 * GET /api/auth/me - get current user
 * POST /api/auth/logout - logout
 */

import { Router } from 'express';
import { validateDemoPassword, setSessionUser, getSessionUser, clearSessionUser } from '../services/sessionService';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PASSWORD', message: 'Password is required' },
      });
    }

    if (!validateDemoPassword(password)) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Invalid password' },
      });
    }

    // Set session user
    setSessionUser(req, {
      userId: 'demo-user-id',
      userName: 'Demo User',
    });

    res.json({
      success: true,
      data: {
        userId: 'demo-user-id',
        userName: 'Demo User',
        message: 'Logged in successfully',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_ERROR', message: 'Login failed' },
    });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  try {
    const user = getSessionUser(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' },
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'GET_USER_ERROR', message: 'Failed to get user' },
    });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  try {
    clearSessionUser(req);

    res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGOUT_ERROR', message: 'Logout failed' },
    });
  }
});

export default router;
