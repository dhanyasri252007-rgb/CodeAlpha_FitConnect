import express from 'express';
import session from 'express-session';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

// Load Environment variables
dotenv.config();

// Import Routes
import authRoutes from './routes/auth';
import postRoutes from './routes/posts';
import profileRoutes from './routes/profile';
import followRoutes from './routes/follows';

const app = express();
const PORT = 3000;

// Create public static file directories if they don't exist
const publicDir = path.resolve(process.cwd(), 'public');
const cssDir = path.join(publicDir, 'css');
const jsDir = path.join(publicDir, 'js');
const uploadsDir = path.join(publicDir, 'uploads');

[publicDir, cssDir, jsDir, uploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure EJS View Engine
app.set('view engine', 'ejs');
app.set('views', path.resolve(process.cwd(), 'views'));

// Body Parser Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fitconnect-fitness-athletic-adventure-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 Week session life
      sameSite: 'lax',
      secure: false // Set to true in production with HTTPS
    }
  })
);

// Serve static assets out of the PUBLIC folder
app.use(express.static(publicDir));

// Connect all route handlers
app.use('/', authRoutes);
app.use('/', postRoutes);
app.use('/', profileRoutes);
app.use('/', followRoutes);

// Error Handling Middleware for nice fallback screens
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled runtime error:', err);
  res.status(500).render('dashboard', {
    user: (req.session as any).userId ? { username: (req.session as any).username } : null,
    posts: [],
    activeTab: 'community',
    error: 'System encountered an error. Please try again later.'
  });
});

// Wildcard 404 handler
app.use((req, res) => {
  res.status(404).render('dashboard', {
    user: (req.session as any).userId ? { username: (req.session as any).username } : null,
    posts: [],
    activeTab: 'community',
    error: 'The requested page has run out of cardio. Code 404: Not Found.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FitConnect application started at http://localhost:${PORT}`);
});
