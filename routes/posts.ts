import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Post, Comment, User, populateUser, isUsingLocalDb } from '../config/db';

const router = express.Router();

// Ensure uploads folder exists
const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'fitconnect-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (accept images only)
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB Limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Error: Images only!'));
    }
  }
});

// Auth Guard
export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!(req.session as any).userId) {
    return res.redirect('/login');
  }
  next();
}

// Helper to assemble active posts with hydrated users, comments, and comment-user profiles
async function getHydratedPosts(filterQuery: any = {}): Promise<any[]> {
  const posts = await Post.find(filterQuery);
  
  // Sort posts descending manually (since sorting is mock-friendly on dates)
  const sortedPosts = posts.sort((a, b) => {
    const aTime = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0;
    const bTime = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0;
    return bTime - aTime;
  });

  const hydrated = [];
  for (const post of sortedPosts) {
    const userProfile = await populateUser(post.user);
    
    // Fetch and hydrate comments
    const comments = await Comment.find({ post: post._id });
    const sortedComments = comments.sort((a, b) => {
      const aTime = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0;
      const bTime = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0;
      return aTime - bTime;
    });
    
    const hydratedComments = [];
    for (const comment of sortedComments) {
      const commenterProfile = await populateUser(comment.user);
      const rawComment = typeof comment.toObject === 'function' ? comment.toObject() : comment;
      hydratedComments.push({
        ...rawComment,
        user: commenterProfile || { username: 'deleted_user', fitnessGoal: '', bio: '' }
      });
    }

    const rawPost = typeof post.toObject === 'function' ? post.toObject() : post;
    hydrated.push({
      ...rawPost,
      user: userProfile || { username: 'deleted_user', fitnessGoal: 'General Fitness', bio: '' },
      comments: hydratedComments
    });
  }

  return hydrated;
}

// GET / => Community Feed / Dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    const currentUserId = (req.session as any).userId;
    const currentUser = await User.findById(currentUserId);
    
    // Default to 'community' or 'following' tab
    const tab = req.query.tab === 'following' ? 'following' : 'community';
    let filter = {};

    if (tab === 'following') {
      // Find who current user is following
      const { Follower } = await import('../config/db');
      const connections = await Follower.find({ follower: currentUserId });
      const followingIds = connections.map(c => c.following);
      
      // Include current user's posts in following feed as well
      filter = { user: { $in: [...followingIds, currentUserId] } };
    }

    const posts = await getHydratedPosts(filter);

    res.render('dashboard', {
      user: currentUser,
      posts: posts,
      activeTab: tab,
      error: null
    });
  } catch (err) {
    console.error('Error fetching timeline:', err);
    res.render('dashboard', {
      user: null,
      posts: [],
      activeTab: 'community',
      error: 'Could not load posts. Please try again.'
    });
  }
});

// POST /posts => Create a new Post
router.post('/posts', requireAuth, upload.single('postImage'), async (req, res) => {
  const { content, imageUrl } = req.body;
  const userId = (req.session as any).userId;

  try {
    if (!content || content.trim().length === 0) {
      // Fetch data back for rendering error
      const currentUser = await User.findById(userId);
      const posts = await getHydratedPosts();
      return res.render('dashboard', {
        user: currentUser,
        posts,
        activeTab: 'community',
        error: 'Post content cannot be empty.'
      });
    }

    // Determine final image path/URL
    let finalImage = '';
    if (req.file) {
      // Saved image file
      finalImage = '/uploads/' + req.file.filename;
    } else if (imageUrl && imageUrl.trim().length > 0) {
      // External URL paste
      finalImage = imageUrl.trim();
    }

    await Post.create({
      user: userId,
      content: content.trim(),
      image: finalImage,
      likes: []
    });

    res.redirect('/');
  } catch (err: any) {
    console.error('Create post error:', err);
    const currentUser = await User.findById(userId);
    const posts = await getHydratedPosts();
    res.render('dashboard', {
      user: currentUser,
      posts,
      activeTab: 'community',
      error: err.message || 'Failed to create post. Please try again.'
    });
  }
});

// POST /posts/:id/like => Toggle like (AJAX friendly)
router.post('/posts/:id/like', requireAuth, async (req, res) => {
  const postId = req.params.id;
  const userId = (req.session as any).userId;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    let liked = false;
    post.likes = post.likes || [];
    
    // Check if user already liked
    if (post.likes.includes(userId)) {
      // Unlike
      post.likes = post.likes.filter((id: string) => id !== userId);
    } else {
      // Like
      post.likes.push(userId);
      liked = true;
    }

    await post.save();

    // If request has header for json response, return JSON
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        liked: liked,
        likeCount: post.likes.length
      });
    }

    // Otherwise redirect back
    res.redirect('back');
  } catch (err) {
    console.error('Like toggle error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /posts/:id/comment => Add comment
router.post('/posts/:id/comment', requireAuth, async (req, res) => {
  const postId = req.params.id;
  const { content } = req.body;
  const userId = (req.session as any).userId;

  try {
    if (!content || content.trim().length === 0) {
      return res.redirect('back');
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).send('Post not found');
    }

    const newComment = await Comment.create({
      post: postId,
      user: userId,
      content: content.trim()
    });

    // If AJAX request, return formatted comment details
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      const commenterProfile = await populateUser(userId);
      return res.json({
        success: true,
        comment: {
          _id: newComment._id,
          content: newComment.content,
          createdAt: newComment.createdAt.toLocaleString(),
          user: commenterProfile
        }
      });
    }

    res.redirect('back');
  } catch (err) {
    console.error('Comment error:', err);
    res.redirect('back');
  }
});

// POST /posts/:id/delete => Delete post (for author)
router.post('/posts/:id/delete', requireAuth, async (req, res) => {
  const postId = req.params.id;
  const userId = (req.session as any).userId;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).send('Post not found');
    }

    // Ensure they are the author
    if (post.user !== userId && post.user.toString() !== userId) {
      return res.status(403).send('Unauthorized');
    }

    await Post.findByIdAndDelete(postId);
    
    // Also delete any associated comments
    const comments = await Comment.find({ post: postId });
    for (const c of comments) {
      await Comment.findByIdAndDelete(c._id);
    }

    res.redirect('/');
  } catch (err) {
    console.error('Delete post error:', err);
    res.redirect('/');
  }
});

export default router;
