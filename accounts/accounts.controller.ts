import express from 'express';
import Joi from 'joi';
import validateRequest from '../_middleware/validate-request';
import authorize from '../_middleware/authorize';
import Role from '../_helpers/role';
import accountService from './account.service';

const router = express.Router();

// ==================== ROUTE DEFINITIONS ====================

// Public routes (no authentication required)
router.post('/authenticate', authenticateSchema, authenticate);
router.post('/refresh-token', refreshTokenHandler);
router.post('/register', registerSchema, register);
router.post('/verify-email', verifyEmailSchema, verifyEmail);
router.post('/forgot-password', forgotPasswordSchema, forgotPassword);
router.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
router.post('/reset-password', resetPasswordSchema, resetPassword);

// Authenticated routes (require valid JWT)
router.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
router.get('/:id', authorize(), getById);
router.put('/:id', authorize(), updateSchema, update);
router.delete('/:id', authorize(), _delete);

// Admin only routes
router.get('/', authorize([Role.Admin]), getAll);
router.post('/', authorize([Role.Admin]), createSchema, create);

export default router;

// ==================== SCHEMA VALIDATION FUNCTIONS ====================

function authenticateSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
    });
    validateRequest(req, next, schema);
}

function revokeTokenSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        token: Joi.string().empty('')
    });
    validateRequest(req, next, schema);
}

function registerSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        title: Joi.string().valid('Mr', 'Mrs', 'Miss', 'Ms', 'Dr').required(),
        firstName: Joi.string().min(2).max(50).required(),
        lastName: Joi.string().min(2).max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        acceptTerms: Joi.boolean().valid(true).required()
    });
    validateRequest(req, next, schema);
}

function verifyEmailSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function forgotPasswordSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        email: Joi.string().email().required()
    });
    validateRequest(req, next, schema);
}

function validateResetTokenSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        token: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function resetPasswordSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

function createSchema(req: any, res: any, next: any) {
    const schema = Joi.object({
        title: Joi.string().valid('Mr', 'Mrs', 'Miss', 'Ms', 'Dr').required(),
        firstName: Joi.string().min(2).max(50).required(),
        lastName: Joi.string().min(2).max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        role: Joi.string().valid(Role.Admin, Role.User).required()
    });
    validateRequest(req, next, schema);
}

function updateSchema(req: any, res: any, next: any) {
    const schemaRules: any = {
        title: Joi.string().valid('Mr', 'Mrs', 'Miss', 'Ms', 'Dr').empty(''),
        firstName: Joi.string().min(2).max(50).empty(''),
        lastName: Joi.string().min(2).max(50).empty(''),
        email: Joi.string().email().empty(''),
        password: Joi.string().min(6).empty(''),
        confirmPassword: Joi.string().valid(Joi.ref('password')).empty('')
    };
    
    if (req.user.role === Role.Admin) {
        schemaRules.role = Joi.string().valid(Role.Admin, Role.User).empty('');
    }
    
    const schema = Joi.object(schemaRules).with('password', 'confirmPassword');
    validateRequest(req, next, schema);
}

// ==================== ROUTE HANDLERS ====================

function authenticate(req: any, res: any, next: any) {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    
    accountService.authenticate({ email, password, ipAddress })
        .then(({ refreshToken, ...account }: any) => {
            setTokenCookie(res, refreshToken);
            res.json(account);
        })
        .catch(next);
}

function refreshTokenHandler(req: any, res: any, next: any) {
    const token = req.cookies.refreshToken;
    const ipAddress = req.ip;
    
    if (!token) {
        return res.status(401).json({ message: 'Refresh token required' });
    }
    
    accountService.refreshToken({ token, ipAddress })
        .then(({ refreshToken, ...account }: any) => {
            setTokenCookie(res, refreshToken);
            res.json(account);
        })
        .catch(next);
}

function revokeToken(req: any, res: any, next: any) {
    const token = req.body.token || req.cookies.refreshToken;
    const ipAddress = req.ip;
    
    if (!token) {
        return res.status(400).json({ message: 'Token is required' });
    }
    
    if (!req.user.ownsToken(token) && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    accountService.revokeToken({ token, ipAddress })
        .then(() => res.json({ message: 'Token revoked successfully' }))
        .catch(next);
}

function register(req: any, res: any, next: any) {
    accountService.register(req.body, req.get('origin'))
        .then(() => res.json({ 
            message: 'Registration successful! Please check your email for verification instructions.' 
        }))
        .catch(next);
}

function verifyEmail(req: any, res: any, next: any) {
    accountService.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful! You can now login.' }))
        .catch(next);
}

function forgotPassword(req: any, res: any, next: any) {
    accountService.forgotPassword(req.body, req.get('origin'))
        .then(() => res.json({ message: 'If your email is registered, you will receive password reset instructions.' }))
        .catch(next);
}

function validateResetToken(req: any, res: any, next: any) {
    accountService.validateResetToken(req.body)
        .then(() => res.json({ message: 'Token is valid' }))
        .catch(next);
}

function resetPassword(req: any, res: any, next: any) {
    accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful! You can now login with your new password.' }))
        .catch(next);
}

function getAll(req: any, res: any, next: any) {
    accountService.getAll()
        .then((accounts: any) => res.json(accounts))
        .catch(next);
}

function getById(req: any, res: any, next: any) {
    if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    accountService.getById(req.params.id)
        .then((account: any) => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}

function create(req: any, res: any, next: any) {
    accountService.create(req.body)
        .then((account: any) => res.json(account))
        .catch(next);
}

function update(req: any, res: any, next: any) {
    if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    accountService.update(req.params.id, req.body)
        .then((account: any) => res.json(account))
        .catch(next);
}

function _delete(req: any, res: any, next: any) {
    if (Number(req.params.id) !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    
    accountService.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
        .catch(next);
}

function setTokenCookie(res: any, token: any) {
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
    res.cookie('refreshToken', token, cookieOptions);
}