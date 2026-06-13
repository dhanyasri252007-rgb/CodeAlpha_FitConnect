/**
 * FitConnect - Client-Side Operations Manager
 * Beginner-friendly, purely written in vanilla JavasScript.
 * Handles DOM operations, AJAX calls for likes & comments, filters, and mini-widgets.
 */

document.addEventListener("DOMContentLoaded", function() {
  
  // ==========================================
  // MOBILE NAVIGATION DRAWER
  // ==========================================
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function() {
      navMenu.classList.toggle("show");
      
      // Update toggle icon
      const icon = navToggle.querySelector("i");
      if (icon) {
        if (navMenu.classList.contains("show")) {
          icon.setAttribute("data-lucide", "x");
        } else {
          icon.setAttribute("data-lucide", "menu");
        }
        lucide.createIcons();
      }
    });
  }

  // ==========================================
  // ATTACHMENT TRAY SELECTOR IN FORM
  // ==========================================
  const toggleAttachmentBtn = document.getElementById("toggleAttachmentBtn");
  const postAttachments = document.getElementById("postAttachments");

  if (toggleAttachmentBtn && postAttachments) {
    toggleAttachmentBtn.addEventListener("click", function() {
      const isHidden = postAttachments.style.display === "none";
      postAttachments.style.display = isHidden ? "flex" : "none";
      
      // Toggle button style
      toggleAttachmentBtn.classList.toggle("btn-navy-outline", isHidden);
      toggleAttachmentBtn.classList.toggle("btn-light", !isHidden);
    });
  }

  // ==========================================
  // ATHLETIC MOTIVATION MOTTO GENERATOR
  // ==========================================
  const quotes = [
    { text: "Success isn't always about greatness. It's about consistency. Consistent hard work leads to success.", author: "Dwayne Johnson" },
    { text: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon" },
    { text: "PRs are built on the days you absolutely did not want to show up to the platform.", author: "Barbell Coach" },
    { text: "Whether you think you can or you think you can't, you're right. Lock your heels and push.", author: "Henry Ford" },
    { text: "The clock is ticking. Are you taking active logs toward becoming your highest vision?", author: "Greg Plitt" },
    { text: "Consistency is not about perfection. It's about showing up to do 1% better every dusk.", author: "Mindset Healer" }
  ];

  const mottoText = document.getElementById("motivationalQuote");
  if (mottoText) {
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    mottoText.textContent = `"${randomQuote.text}"`;
    const authorBox = mottoText.nextElementSibling;
    if (authorBox && authorBox.tagName === "SMALL") {
      authorBox.innerHTML = `&mdash; ${randomQuote.author}`;
    }
  }

  // ==========================================
  // SIDEBAR DYNAMIC DISCOVER ROSTER SEEDER
  // ==========================================
  const miniList = document.getElementById("mini-discover-list");
  if (miniList) {
    // Gracefully fetch other athletes via AJAX to display on the sidebar
    fetch("/discover", { headers: { "Accept": "text/html" } })
      .then(res => res.text())
      .then(html => {
        // Parse the returned HTML document
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const cards = doc.querySelectorAll(".peer-card");
        
        if (cards.length === 0) {
          miniList.innerHTML = '<p class="loading-placeholder">You\'re the only athlete registered yet!</p>';
          return;
        }

        miniList.innerHTML = "";
        
        // Take up to 3 random users
        const usersArray = Array.from(cards);
        const shuffled = usersArray.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);

        selected.forEach(card => {
          const username = card.getAttribute("data-username");
          const goal = card.getAttribute("data-goal") || "Strength Builder";
          const peerId = card.querySelector(".follow-btn")?.getAttribute("onclick")?.match(/'([^']+)'/)?.[1] || "";
          const isFollowing = card.querySelector(".follow-btn")?.classList.contains("followed");

          const item = document.createElement("div");
          item.className = "mini-peer-item animate-scale-in";
          item.innerHTML = `
            <div class="mini-peer-left">
              <div class="comment-avatar font-mono">${username.substring(0,1).toUpperCase()}</div>
              <div>
                <h4 class="mini-peer-name"><a href="/profile/${username}">@${username}</a></h4>
                <p class="mini-peer-goal">${goal}</p>
              </div>
            </div>
            ${peerId ? `
              <button class="mini-btn-follow ${isFollowing ? 'followed' : ''}" onclick="togglePeerFollow(this, '${peerId}')">
                ${isFollowing ? 'Connected' : 'Support'}
              </button>
            ` : ''}
          `;
          miniList.appendChild(item);
        });
        
        lucide.createIcons();
      })
      .catch(err => {
        console.error("Mini discover loader error:", err);
        miniList.innerHTML = '<p class="loading-placeholder">Discover box is offline.</p>';
      });
  }
});

// ==========================================
// ASYNC LIKE TOGGLING LOGIC
// ==========================================
window.toggleLike = function(postId) {
  fetch(`/posts/${postId}/like`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Find the matched like button in the DOM
        const postCard = document.querySelector(`article[data-post-id="${postId}"]`);
        if (postCard) {
          const likeBtn = postCard.querySelector(".like-btn");
          const likeCountSpan = likeBtn.querySelector(".like-count");
          const heartIcon = likeBtn.querySelector("i");

          // Toggle classes
          likeBtn.classList.toggle("liked", data.liked);
          likeCountSpan.textContent = data.likeCount;

          // Re-create vector references
          lucide.createIcons();
        }
      }
    })
    .catch(err => console.error("Error toggling like:", err));
};

// ==========================================
// EXPAND COMMENTS TRAY
// ==========================================
window.toggleCommentsSection = function(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (section) {
    const isHidden = section.style.display === "none";
    section.style.display = isHidden ? "block" : "none";
  }
};

// ==========================================
// AJAX COMMENT FORM SUBMIT
// ==========================================
window.submitCommentForm = function(event, postId) {
  event.preventDefault();
  
  const form = event.target;
  const input = form.querySelector(".comment-input");
  const commentContent = input.value;

  if (!commentContent || commentContent.trim().length === 0) return;

  fetch(`/posts/${postId}/comment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    },
    body: JSON.stringify({ content: commentContent })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Clear input field
        input.value = "";

        // Select comments lists
        const list = document.getElementById(`comments-list-${postId}`);
        const noCommentsInfo = list.querySelector(".no-comments-info");
        if (noCommentsInfo) {
          noCommentsInfo.remove();
        }

        // Build comment element bubble
        const commentItem = document.createElement("div");
        commentItem.className = "comment-item animate-slide-in";
        commentItem.innerHTML = `
          <div class="comment-avatar">${data.comment.user.username.substring(0, 1).toUpperCase()}</div>
          <div class="comment-bubble">
            <div class="comment-top">
              <span class="comment-author">@${data.comment.user.username}</span>
              <span class="comment-time">Just now</span>
            </div>
            <p class="comment-text">${data.comment.content}</p>
          </div>
        `;
        list.appendChild(commentItem);

        // Update counts
        const postCard = document.querySelector(`article[data-post-id="${postId}"]`);
        if (postCard) {
          const commentSpanCount = postCard.querySelector(".comment-toggle-btn .comment-count");
          if (commentSpanCount) {
            const curVal = parseInt(commentSpanCount.textContent) || 0;
            commentSpanCount.textContent = curVal + 1;
          }
        }
      }
    })
    .catch(err => console.error("Error creating comment:", err));
};

// ==========================================
// ASYNC FOLLOW TOGGLE (MINI SIDEBAR & DIRECTS)
// ==========================================
window.togglePeerFollow = function(btnElement, peerId) {
  const isFollowing = btnElement.classList.contains("followed");
  const url = isFollowing ? `/unfollow/${peerId}` : `/follow/${peerId}`;

  fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (data.following) {
          btnElement.classList.add("followed");
          btnElement.innerHTML = `<i data-lucide="user-check"></i> Unfollow`;
          btnElement.className = "btn btn-orange-outline btn-xs follow-btn followed";
        } else {
          btnElement.classList.remove("followed");
          btnElement.innerHTML = `<i data-lucide="user-plus"></i> Follow`;
          btnElement.className = "btn btn-primary btn-xs follow-btn";
        }
        lucide.createIcons();
      }
    })
    .catch(err => console.error("Error toggling peer connection:", err));
};

// ==========================================
// ASYNC FOLLOW TOGGLE (DIRECT PROFILE PAGE)
// ==========================================
window.toggleProfileFollow = function(peerId) {
  const button = document.querySelector(".follow-action-btn");
  const isFollowing = button.classList.contains("followed");
  const url = isFollowing ? `/unfollow/${peerId}` : `/follow/${peerId}`;

  fetch(url, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const followerCountSpan = document.getElementById("profileFollowerCount");
        let count = parseInt(followerCountSpan.textContent) || 0;

        if (data.following) {
          button.classList.add("followed");
          button.className = "btn btn-navy-outline btn-sm follow-action-btn followed";
          button.innerHTML = `<i data-lucide="user-check"></i> Connected (Unfollow)`;
          count++;
        } else {
          button.classList.remove("followed");
          button.className = "btn btn-primary btn-sm follow-action-btn";
          button.innerHTML = `<i data-lucide="user-plus"></i> Connect (Follow)`;
          count--;
        }
        followerCountSpan.textContent = count;
        lucide.createIcons();
      }
    })
    .catch(err => console.error("Profile connection toggler error:", err));
};

// ==========================================
// LIVE SEARCH FILTER ON THE DISCOVER TAB
// ==========================================
window.filterPeers = function() {
  const query = document.getElementById("memberSearch").value.toLowerCase().trim();
  const cards = document.querySelectorAll(".peer-card");
  let matchesCount = 0;

  cards.forEach(card => {
    const username = card.getAttribute("data-username").toLowerCase();
    const goal = card.getAttribute("data-goal").toLowerCase();
    
    if (username.includes(query) || goal.includes(query)) {
      card.style.display = "flex";
      matchesCount++;
    } else {
      card.style.display = "none";
    }
  });

  const countBadge = document.getElementById("activeMembersCount");
  if (countBadge) {
    countBadge.textContent = matchesCount;
  }
};

// ==========================================
// EDIT PROFILE MODAL DRAWER TOGGLER
// ==========================================
window.toggleEditProfileModal = function() {
  const modal = document.getElementById("editProfileModal");
  if (modal) {
    const isHidden = modal.style.display === "none";
    modal.style.display = isHidden ? "flex" : "none";
  }
};

// ==========================================
// CALORIE CONVERTER BMR WIDGET
// ==========================================
window.calculateBmr = function() {
  const wInput = document.getElementById("bmrWeight");
  const aInput = document.getElementById("bmrAge");
  const resBox = document.getElementById("bmrResult");

  const weight = parseFloat(wInput.value);
  const age = parseFloat(aInput.value);

  if (!weight || !age || weight <= 0 || age <= 0) {
    resBox.style.display = "block";
    resBox.textContent = "Please set valid weight and age values.";
    return;
  }

  // Quick athletic estimate of basic metabolic consumption
  // Harris-Benedict formula simplified metric approximation
  // For standard maintenance: Multiply weight by ~14 kcal
  const baseKcal = Math.round(weight * 11 + 350);
  const maintenanceKcal = Math.round(baseKcal * 1.35); // Moderate activity

  resBox.style.display = "block";
  resBox.innerHTML = `~${maintenanceKcal} Daily kcal limit`;
};
