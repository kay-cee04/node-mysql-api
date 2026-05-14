import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../_helpers/db';

function authorize(roles: string | string[] = []) {
    // Convert single role to array
    const roleArray = typeof roles === 'string' ? [roles] : roles;
    
    return [
        async (req: any, res: Response, next: NextFunction) => {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({ message: 'No token provided' });
            }
            
            try {
                const secret = process.env.JWT_SECRET || require('../config.json').jwtSecret;
                const decoded = jwt.verify(token, secret) as { id: number };
                req.user = decoded;
                next();
            } catch (err) {
                return res.status(401).json({ message: 'Invalid token' });
            }
        },
        
        async (req: any, res: Response, next: NextFunction) => {
            const account = await db.Account.findByPk(req.user.id);
            
            if (!account) {
                return res.status(401).json({ message: 'Account not found' });
            }
            
            const isAuthorized = roleArray.length === 0 || roleArray.includes(account.role);
            
            if (!isAuthorized) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            
            req.user.role = account.role;
            req.user.ownsToken = (token: string) => {
                return true;
            };
            
            next();
        }
    ];
}

export default authorize;