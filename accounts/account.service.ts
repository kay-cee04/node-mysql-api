import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import sendEmail from '../_helpers/send-email';
import db from '../_helpers/db';
import Role from '../_helpers/role';

// Get JWT secret from environment or config
const jwtSecret = process.env.JWT_SECRET || require('../config.json').jwtSecret;

// Export all service methods
export default {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    create,
    update,
    delete: _delete
};

// ==================== AUTHENTICATION METHODS ====================

/**
 * Authenticate a user with email and password
 * Returns JWT token and refresh token
 */
async function authenticate({ email, password, ipAddress }: any) {
    // Find account by email including password hash
    const account = await db.Account.scope('withHash').findOne({ where: { email } });
    
    // Check if account exists and password is correct
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
        throw 'Email or password is incorrect';
    }
    
    // Check if account is verified
    if (!account.isVerified) {
        throw 'Account not verified. Please check your email for verification link.';
    }
    
    // Generate tokens
    const jwtToken = generateJwtToken(account);
    const refreshToken = generateRefreshToken(account, ipAddress);
    await refreshToken.save();
    
    // Return account details with tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token
    };
}

/**
 * Refresh JWT token using a valid refresh token
 * Implements refresh token rotation for security
 */
async function refreshToken({ token, ipAddress }: any) {
    // Get the refresh token from database
    const refreshToken = await getRefreshToken(token);
    const account = await refreshToken.getAccount();
    
    // Create a new refresh token (rotation)
    const newRefreshToken = generateRefreshToken(account, ipAddress);
    
    // Revoke the old refresh token and link it to the new one
    refreshToken.revoked = new Date();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    
    // Save both tokens
    await refreshToken.save();
    await newRefreshToken.save();
    
    // Generate new JWT token
    const jwtToken = generateJwtToken(account);
    
    // Return account details with new tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}

/**
 * Revoke a refresh token (logout)
 */
async function revokeToken({ token, ipAddress }: any) {
    const refreshToken = await getRefreshToken(token);
    
    // Revoke the token
    refreshToken.revoked = new Date();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}

// ==================== REGISTRATION & VERIFICATION ====================

/**
 * Register a new account
 * First account becomes Admin, subsequent accounts are Users
 */
async function register(params: any, origin: any) {
    // Check if email is already registered
    if (await db.Account.findOne({ where: { email: params.email } })) {
        // Send email that account already exists (prevents email enumeration)
        await sendAlreadyRegisteredEmail(params.email, origin);
        return;
    }
    
    // Create new account
    const account = new db.Account(params);
    
    // First registered account is admin, others are regular users
    const isFirstAccount = (await db.Account.count()) === 0;
    account.role = isFirstAccount ? Role.Admin : Role.User;
    
    // Generate verification token
    account.verificationToken = randomTokenString();
    
    // Hash password
    account.passwordHash = await hash(params.password);
    
    // Save account
    await account.save();
    
    // Send verification email
    await sendVerificationEmail(account, origin);
}

/**
 * Verify an account using the verification token
 */
async function verifyEmail({ token }: any) {
    // Find account by verification token
    const account = await db.Account.findOne({ where: { verificationToken: token } });
    
    if (!account) throw 'Verification failed. Invalid or expired token.';
    
    // Mark account as verified
    account.verified = new Date();
    account.verificationToken = null;
    await account.save();
}

// ==================== PASSWORD RESET METHODS ====================

/**
 * Send password reset email
 */
async function forgotPassword({ email }: any, origin: any) {
    const account = await db.Account.findOne({ where: { email } });
    
    // Always return success to prevent email enumeration
    if (!account) return;
    
    // Generate reset token (expires in 24 hours)
    account.resetToken = randomTokenString();
    account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await account.save();
    
    // Send password reset email
    await sendPasswordResetEmail(account, origin);
}

/**
 * Validate a password reset token
 */
async function validateResetToken({ token }: any) {
    const account = await db.Account.findOne({
        where: {
            resetToken: token,
            resetTokenExpires: { [Op.gt]: Date.now() }
        }
    });
    
    if (!account) throw 'Invalid or expired token';
    return account;
}

/**
 * Reset password using a valid reset token
 */
async function resetPassword({ token, password }: any) {
    // Validate the token first
    const account = await validateResetToken({ token });
    
    // Update password
    account.passwordHash = await hash(password);
    account.passwordReset = new Date();
    account.resetToken = null;
    account.resetTokenExpires = null;
    await account.save();
}

// ==================== CRUD OPERATIONS ====================

/**
 * Get all accounts (Admin only)
 */
async function getAll() {
    const accounts = await db.Account.findAll();
    return accounts.map((x: any) => basicDetails(x));
}

/**
 * Get account by ID
 */
async function getById(id: any) {
    const account = await getAccount(id);
    return basicDetails(account);
}

/**
 * Create a new account (Admin only)
 * Unlike register, this doesn't require email verification
 */
async function create(params: any) {
    // Check if email is already registered
    if (await db.Account.findOne({ where: { email: params.email } })) {
        throw `Email "${params.email}" is already registered`;
    }
    
    const account = new db.Account(params);
    
    // Admin-created accounts are automatically verified
    account.verified = new Date();
    account.passwordHash = await hash(params.password);
    await account.save();
    
    return basicDetails(account);
}

/**
 * Update an account
 */
async function update(id: any, params: any) {
    const account = await getAccount(id);
    
    // Check if email is being changed and already exists
    if (params.email && account.email !== params.email && 
        await db.Account.findOne({ where: { email: params.email } })) {
        throw `Email "${params.email}" is already taken`;
    }
    
    // Hash password if provided
    if (params.password) {
        params.passwordHash = await hash(params.password);
    }
    
    // Update account
    Object.assign(account, params);
    account.updated = new Date();
    await account.save();
    
    return basicDetails(account);
}

/**
 * Delete an account
 */
async function _delete(id: any) {
    const account = await getAccount(id);
    await account.destroy();
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get account by ID or throw error
 */
async function getAccount(id: any) {
    const account = await db.Account.findByPk(id);
    if (!account) throw 'Account not found';
    return account;
}

/**
 * Get refresh token by token value or throw error
 */
async function getRefreshToken(token: any) {
    const refreshToken = await db.RefreshToken.findOne({ where: { token } });
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

/**
 * Generate JWT token (expires in 15 minutes)
 */
function generateJwtToken(account: any) {
    return jwt.sign({ id: account.id }, jwtSecret, { expiresIn: '15m' });
}

/**
 * Generate refresh token (expires in 7 days)
 */
function generateRefreshToken(account: any, ipAddress: any) {
    return new db.RefreshToken({
        accountId: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByIp: ipAddress
    });
}

/**
 * Generate a random token string
 */
function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

/**
 * Hash a password using bcrypt
 */
async function hash(password: string) {
    return await bcrypt.hash(password, 10);
}

/**
 * Return basic account details (excludes sensitive data)
 */
function basicDetails(account: any) {
    const { id, title, firstName, lastName, email, role, created, updated, isVerified } = account;
    return { id, title, firstName, lastName, email, role, created, updated, isVerified };
}

// ==================== EMAIL FUNCTIONS ====================

/**
 * Send verification email to new user
 */
async function sendVerificationEmail(account: any, origin: any) {
    let message;
    if (origin) {
        const verifyUrl = `${origin}/account/verify-email?token=${account.verificationToken}`;
        message = `<p>Please click the link below to verify your email address:</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>
                   <p>The link will expire in 24 hours.</p>`;
    } else {
        message = `<p>Please use the below token to verify your email address with the <code>/accounts/verify-email</code> api route:</p>
                   <p><code>${account.verificationToken}</code></p>`;
    }
    
    await sendEmail({
        to: account.email,
        subject: 'Verify Your Email Address',
        html: `
            <h2>Welcome to Our Platform!</h2>
            <p>Thanks for registering!</p>
            ${message}
            <hr>
            <p><small>If you didn't create an account, please ignore this email.</small></p>
        `
    });
}

/**
 * Send email when someone tries to register with an existing email
 */
async function sendAlreadyRegisteredEmail(email: string, origin: any) {
    let message;
    if (origin) {
        message = `<p>If you forgot your password, please click the link below to reset it:</p>
                   <p><a href="${origin}/account/forgot-password">Reset Password</a></p>`;
    } else {
        message = `<p>If you forgot your password, you can reset it via the <code>/accounts/forgot-password</code> api route.</p>`;
    }
    
    await sendEmail({
        to: email,
        subject: 'Email Already Registered',
        html: `
            <h2>Email Already Registered</h2>
            <p>Your email <strong>${email}</strong> is already registered in our system.</p>
            ${message}
            <hr>
            <p><small>If you didn't attempt to register, please ignore this email.</small></p>
        `
    });
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(account: any, origin: any) {
    let message;
    if (origin) {
        const resetUrl = `${origin}/account/reset-password?token=${account.resetToken}`;
        message = `<p>Please click the link below to reset your password:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>
                   <p>This link will be valid for 24 hours.</p>`;
    } else {
        message = `<p>Please use the below token to reset your password with the <code>/accounts/reset-password</code> api route:</p>
                   <p><code>${account.resetToken}</code></p>`;
    }
    
    await sendEmail({
        to: account.email,
        subject: 'Reset Your Password',
        html: `
            <h2>Password Reset Request</h2>
            <p>We received a request to reset the password for your account.</p>
            ${message}
            <p>If you didn't request this, please ignore this email.</p>
            <hr>
            <p><small>This is an automated message, please do not reply.</small></p>
        `
    });
}