require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { generalLimiter, scanLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

// Routes
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const studentsRoutes = require('./routes/students');
const dashboardRoutes = require('./routes/dashboard');
const exportRoutes = require('./routes/export');
const teachersRoutes = require('./routes/teachers');
const auditRoutes = require('./routes/audit');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Attach Socket.IO to app context
app.set('io', io);

// Security and utility middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable CSP restrictions for static client asset loading
}));
app.use(cors());
app.use(express.json());

app.use(generalLimiter);

app.use(express.static(path.join(__dirname, '../public')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance/scan', scanLimiter);
app.use('/api/rfid/scan', scanLimiter); // Apply same rate limit to the new scan endpoint
app.use('/api/attendance', attendanceRoutes);
app.use('/api/rfid', attendanceRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/audit-logs', auditRoutes);

// Socket.IO lifecycle logs
io.on('connection', (socket) => {
    logger.info(`Dashboard socket client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        logger.info(`Dashboard socket client disconnected: ${socket.id}`);
    });
});

// Single Page Application Fallback
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start HTTP Server
server.listen(config.PORT, () => {
    logger.info(`Server is running on port ${config.PORT}`);
});
