const jwt = require('jsonwebtoken');
const config = require('../config');

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, config.JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
            }
            req.user = user;
            next();
        });
    } else {
        res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
};

const authenticateAPIKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === config.API_KEY) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
};

const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to access this resource' });
        }
        next();
    };
};

module.exports = {
    authenticateJWT,
    authenticateAPIKey,
    requireRole
};
