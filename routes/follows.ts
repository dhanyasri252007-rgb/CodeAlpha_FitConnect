import express from 'express';
import { User, Follower, populateUser } from '../config/db';
import { requireAuth } from './posts';

const router = express.Router();

// GET /discover => Discover other fitness enthusiasts
router.get('/discover', requireAuth, async (req, res) => {
  const currentUserId = (req.session as any).userId;

  try {
    const list = await User.find();
    // Exclude current user from discover feed
    const otherUsers = list.filter(user => user._id !== currentUserId && user._id.toString() !== currentUserId);

    // Hydrate follow status
    const formattedUsers = [];
    for (const other of otherUsers) {
      const followEntity = await Follower.findOne({
        follower: currentUserId,
        following: other._id
      });
      const rawOther = typeof other.toObject === 'function' ? other.toObject() : other;
      formattedUsers.push({
        ...rawOther,
        isFollowing: !!followEntity
      });
    }

    const currentUser = await User.findById(currentUserId);

    res.render('discover', {
      user: currentUser,
      users: formattedUsers,
      error: null
    });
  } catch (err) {
    console.error('Discover page error:', err);
    res.redirect('/');
  }
});

// POST /follow/:id => Follow a user (AJAX friendly)
router.post('/follow/:id', requireAuth, async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = (req.session as any).userId;

  try {
    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: "You cannot follow yourself." });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Check if already following
    const existing = await Follower.findOne({
      follower: currentUserId,
      following: targetUserId
    });

    if (!existing) {
      await Follower.create({
        follower: currentUserId,
        following: targetUserId
      });
    }

    // If AJAX request, return json status
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, following: true });
    }

    res.redirect('back');
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /unfollow/:id => Unfollow a user (AJAX friendly)
router.post('/unfollow/:id', requireAuth, async (req, res) => {
  const targetUserId = req.params.id;
  const currentUserId = (req.session as any).userId;

  try {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    await Follower.deleteOne({
      follower: currentUserId,
      following: targetUserId
    });

    // If AJAX request, return json status
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, following: false });
    }

    res.redirect('back');
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
