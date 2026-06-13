import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';

const router = express.Router();

// Middleware to check if user is already logged in
export function redirectIfLoggedIn(req: express.Request, res: express.Response, next: express.NextFunction) {
  if ((req.session as any).userId) {
    return res.redirect('/');
  }
  next();
}

// GET /register
router.get('/register', redirectIfLoggedIn, (req, res) => {
  res.render('register', { error: null, success: null });
});

// POST /register
router.post('/register', redirectIfLoggedIn, async (req, res) => {
  const { username, email, password, confirmPassword, fitnessGoal, bio } = req.body;

  try {
    // Basic validations
    if (!username || !email || !password || !confirmPassword) {
      return res.render('register', { error: 'All fields are required.', success: null });
    }

    if (username.length < 3) {
      return res.render('register', { error: 'Username must be at least 3 characters.', success: null });
    }

    if (password.length < 6) {
      return res.render('register', { error: 'Password must be at least 6 characters.', success: null });
    }

    if (password !== confirmPassword) {
      return res.render('register', { error: 'Passwords do not match.', success: null });
    }

    // Check if user already exists
    const existingUserByEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingUserByEmail) {
      return res.render('register', { error: 'Email is already registered.', success: null });
    }

    const existingUserByUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUserByUsername) {
      return res.render('register', { error: 'Username is already taken.', success: null });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create custom user profile
    const newUser = await User.create({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      fitnessGoal: fitnessGoal || 'General Fitness',
      bio: bio || '',
      profilePic: ''
    });

    // Automatically set the session
    (req.session as any).userId = newUser._id;
    (req.session as any).username = newUser.username;

    res.redirect('/');
  } catch (err: any) {
    console.error('Registration error:', err);
    res.render('register', { error: 'Something went wrong. Please try again.', success: null });
  }
});

// GET /login
router.get('/login', redirectIfLoggedIn, (req, res) => {
  res.render('login', { error: null, success: null });
});

// POST /login
router.post('/login', redirectIfLoggedIn, async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.render('login', { error: 'Please enter both email and password.', success: null });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.render('login', { error: 'Invalid email or password.', success: null });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password.', success: null });
    }

    // Set Express Session
    (req.session as any).userId = user._id;
    (req.session as any).username = user.username;

    res.redirect('/');
  } catch (err: any) {
    console.error('Login error:', err);
    res.render('login', { error: 'Something went wrong. Please try again.', success: null });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout session destruction error:', err);
    }
    res.redirect('/login');
  });
});

export default router;
