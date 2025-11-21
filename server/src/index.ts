// Load environment variables FIRST
import './config/env';

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from './config/passport';
import authRoutes from './routes/auth';
import workflowRoutes from './routes/workflow';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use(session({
    secret: process.env.JWT_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/workflow', workflowRoutes);

// Serve static files from the frontend build
const distPath = path.join(__dirname, '../../dist');
app.use(express.static(distPath));

// Handle client-side routing - serve index.html for all non-API routes
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Serving static files from: ${distPath}`);
});
