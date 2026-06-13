import express from 'express';
import { User, Post, Follower, populateUser } from '../config/db';
import { requireAuth } from './posts';

const router = express.Router();

// Helper to hydrate posts for profiles
async function getProfilePosts(userId: string): Promise<any[]> {
  const posts = await Post.find({ user: userId });
  const sortedPosts = posts.sort((a, b) => {
    const aTime = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0;
    const bTime = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0;
    return bTime - aTime;
  });
  
  const { Comment } = await import('../config/db');

  const hydrated = [];
  for (const post of sortedPosts) {
    const userProfile = await populateUser(post.user);
    const comments = await Comment.find({ post: post._id });
    
    const hydratedComments = [];
    for (const comment of comments) {
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
      user: userProfile,
      comments: hydratedComments.sort((a, b) => {
        const aTime = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0;
        const bTime = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0;
        return aTime - bTime;
      })
    });
  }
  return hydrated;
}

// GET /profile/:username => View User Profile
router.get('/profile/:username', requireAuth, async (req, res) => {
  const targetUsername = req.params.username.toLowerCase().trim();
  const currentUserId = (req.session as any).userId;

  try {
    const targetUser = await User.findOne({ username: targetUsername });
    if (!targetUser) {
      return res.status(404).render('dashboard', {
        user: await User.findById(currentUserId),
        posts: [],
        activeTab: 'community',
        error: `User "${targetUsername}" not found.`
      });
    }

    // Load profile statistics
    const followerCount = await Follower.countDocuments({ following: targetUser._id });
    const followingCount = await Follower.countDocuments({ follower: targetUser._id });
    const postsCount = await Post.countDocuments({ user: targetUser._id });

    // Check if the current logged-in user is following this search-profile user
    const existsConnection = await Follower.findOne({
      follower: currentUserId,
      following: targetUser._id
    });
    const isFollowing = !!existsConnection;

    const posts = await getProfilePosts(targetUser._id);
    const currentUser = await User.findById(currentUserId);

    res.render('profile', {
      user: currentUser, // Logged in user info
      profileUser: targetUser, // Target profile user info
      posts: posts,
      followerCount,
      followingCount,
      postsCount,
      isFollowing,
      error: null
    });
  } catch (err) {
    console.error('Profile load error:', err);
    res.redirect('/');
  }
});

// POST /profile/update => Update Bio & Fitness Goal
router.post('/profile/update', requireAuth, async (req, res) => {
  const currentUserId = (req.session as any).userId;
  const { bio, fitnessGoal } = req.body;

  try {
    const user = await User.findById(currentUserId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    await User.findByIdAndUpdate(currentUserId, {
      bio: bio ? bio.trim() : '',
      fitnessGoal: fitnessGoal || 'General Fitness'
    });

    res.redirect(`/profile/${user.username}`);
  } catch (err) {
    console.error('Profile update error:', err);
    res.redirect('/');
  }
});

export default router;
