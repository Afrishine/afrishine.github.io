
/* =========================================================
   AFRISHINE HUB - PROFILE SOCIAL STATS
   Followers + Following + Likes
   Uses existing Firebase and Firestore.
   Does not replace existing Profile or Dashboard functions.

   Load AFTER the main index.html application scripts.
========================================================= */

(function (window, document) {
  'use strict';

  if (window.AHProfileSocialStats) return;

  var refreshVersion = 0;
  var modal = null;
  var initialized = false;

  // -----------------------------------------
  // EXISTING FIREBASE CONNECTION
  // -----------------------------------------

  function getDB() {
    try {
      if (typeof db !== 'undefined' && db) return db;
    } catch (e) {}

    return null;
  }

  function getUser() {
    try {
      if (typeof currentFirebaseUser !== 'undefined' &&
          currentFirebaseUser) {
        return currentFirebaseUser;
      }

      if (typeof currentUser === 'function') {
        return currentUser();
      }
    } catch (e) {}

    return null;
  }

  function getById(id) {
    return document.getElementById(id);
  }

  function safeText(value) {
    return String(value == null ? '' : value);
  }

  // -----------------------------------------
  // STYLES
  // -----------------------------------------

  function addStyles() {
    if (getById('ahProfileSocialStyles')) return;

    var css = `
      .ah-profile-stats > span[data-ah-social] {
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }

      .ah-profile-stats > span[data-ah-social]:active {
        opacity: .7;
      }

      .ah-profile-stats > span[data-ah-social]:focus {
        outline: 2px solid var(--gold, #ffb91f);
        outline-offset: 4px;
        border-radius: 5px;
      }

      #ahSocialModal {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 15000;
        background: rgba(0,0,0,.78);
        align-items: center;
        justify-content: center;
        padding: 15px;
      }

      #ahSocialModal.open {
        display: flex;
      }

      .ah-social-box {
        width: 100%;
        max-width: 440px;
        max-height: 80vh;
        max-height: 80dvh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #141a25;
        border: 1px solid #394355;
        border-radius: 19px;
      }

      .ah-social-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 17px;
        border-bottom: 1px solid #303747;
        flex-shrink: 0;
      }

      .ah-social-header h3 {
        font-size: 19px;
        color: #fff;
      }

      .ah-social-close {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1px solid #394355;
        background: #222a38;
        color: white;
        font-size: 20px;
        cursor: pointer;
      }

      .ah-social-list {
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        min-height: 100px;
      }

      .ah-social-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 13px 16px;
        border-bottom: 1px solid rgba(255,255,255,.06);
      }

      .ah-social-avatar {
        width: 47px;
        height: 47px;
        flex-shrink: 0;
        border-radius: 50%;
        object-fit: cover;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #303747;
        color: #ffbf36;
        font-size: 18px;
        font-weight: 800;
      }

      .ah-social-name {
        flex: 1;
        min-width: 0;
        color: #fff;
        font-weight: 700;
        font-size: 14px;
        overflow-wrap: anywhere;
      }

      .ah-social-empty {
        text-align: center;
        padding: 35px 15px;
        color: #aeb6c5;
        font-size: 14px;
      }

      .ah-social-loading {
        text-align: center;
        padding: 30px;
        color: #aeb6c5;
      }
    `;

    var style = document.createElement('style');
    style.id = 'ahProfileSocialStyles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // -----------------------------------------
  // CREATE MODAL
  // -----------------------------------------

  function createModal() {
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'ahSocialModal';

    modal.innerHTML = `
      <div class="ah-social-box" role="dialog"
        aria-modal="true" aria-labelledby="ahSocialTitle">

        <div class="ah-social-header">
          <h3 id="ahSocialTitle">Followers</h3>

          <button type="button"
            class="ah-social-close"
            id="ahSocialClose"
            aria-label="Close">×</button>
        </div>

        <div class="ah-social-list"
          id="ahSocialList"></div>

      </div>
    `;

    document.body.appendChild(modal);

    getById('ahSocialClose').addEventListener(
      'click', closeModal
    );

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
      }
    });
  }

  function closeModal() {
    if (modal) modal.classList.remove('open');
  }

  // -----------------------------------------
  // PROFILE STATS UI
  // -----------------------------------------

  function setupProfileStats() {
    var hero = getById('ahProfileDashboard');
    if (!hero) return;

    var stats = hero.querySelector('.ah-profile-stats');
    if (!stats) return;

    var followers = getById('ahFollowerStat');
    var following = getById('ahFollowingStat');

    if (!followers || !following) return;

    followers.setAttribute('data-ah-social', 'followers');
    following.setAttribute('data-ah-social', 'following');

    followers.setAttribute('role', 'button');
    following.setAttribute('role', 'button');

    followers.setAttribute('tabindex', '0');
    following.setAttribute('tabindex', '0');

    // Add Likes only once.
    var likes = getById('ahLikesStat');

    if (!likes) {
      likes = document.createElement('span');
      likes.id = 'ahLikesStat';
      likes.setAttribute('data-ah-social', 'likes');
      likes.setAttribute('role', 'status');

      likes.innerHTML = '0<small>likes</small>';

      stats.appendChild(likes);
    }

    // Attach click actions only once.
    if (!stats.__ahSocialBound) {
      stats.__ahSocialBound = true;

      stats.addEventListener('click', function (e) {
        var item = e.target;

        while (item && item !== stats) {
          var action = item.getAttribute &&
            item.getAttribute('data-ah-social');

          if (action) {
            if (action === 'followers' ||
                action === 'following') {
              openList(action);
            }
            return;
          }

          item = item.parentNode;
        }
      });

      stats.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;

        var item = e.target;

        if (!item.getAttribute) return;

        var action = item.getAttribute('data-ah-social');

        if (action === 'followers' || action === 'following') {
          e.preventDefault();
          openList(action);
        }
      });
    }
  }

  // -----------------------------------------
  // UPDATE COUNTS
  // -----------------------------------------

  async function refresh() {
    var version = ++refreshVersion;

    setupProfileStats();

    var user = getUser();
    var database = getDB();

    var followers = getById('ahFollowerStat');
    var following = getById('ahFollowingStat');
    var likes = getById('ahLikesStat');

    if (!user || !database) {
      if (likes) likes.innerHTML = '0<small>likes</small>';
      return;
    }

    try {
      var results = await Promise.all([
        database.collection('follows')
          .where('followingUid', '==', user.uid)
          .get(),

        database.collection('follows')
          .where('followerUid', '==', user.uid)
          .get(),

        database.collection('posts')
          .where('uid', '==', user.uid)
          .get()
      ]);

      if (version !== refreshVersion) return;

      if (followers) {
        followers.innerHTML =
          results[0].size + '<small>followers</small>';
      }

      if (following) {
        following.innerHTML =
          results[1].size + '<small>following</small>';
      }

      // Count likes received on the user's own posts.
      var postDocs = results[2].docs;
      var totalLikes = 0;

      // Read in small batches to avoid overloading older phones.
      for (var i = 0; i < postDocs.length; i += 8) {
        var batch = postDocs.slice(i, i + 8);

        var counts = await Promise.all(
          batch.map(function (post) {
            return post.ref.collection('likes').get();
          })
        );

        for (var j = 0; j < counts.length; j++) {
          totalLikes += counts[j].size;
        }
      }

      if (version !== refreshVersion) return;

      if (likes) {
        likes.innerHTML =
          totalLikes + '<small>likes</small>';
      }

    } catch (error) {
      console.warn('[AH Profile Social Stats]', error);
    }
  }

  // -----------------------------------------
  // FOLLOWERS / FOLLOWING LIST
  // -----------------------------------------

  async function openList(type) {
    var user = getUser();
    var database = getDB();

    if (!user || !database) return;

    createModal();

    modal.classList.add('open');

    var title = getById('ahSocialTitle');
    var list = getById('ahSocialList');

    title.textContent =
      type === 'followers' ? 'Followers' : 'Following';

    list.innerHTML =
      '<div class="ah-social-loading">Loading...</div>';

    try {
      var query = type === 'followers'
        ? database.collection('follows')
            .where('followingUid', '==', user.uid)
        : database.collection('follows')
            .where('followerUid', '==', user.uid);

      var snapshot = await query.get();

      if (!modal.classList.contains('open')) return;

      if (snapshot.empty) {
        list.innerHTML =
          '<div class="ah-social-empty">No members found.</div>';
        return;
      }

      var ids = snapshot.docs.map(function (doc) {
        var data = doc.data();

        return type === 'followers'
          ? data.followerUid
          : data.followingUid;
      }).filter(function (id) {
        return id && id !== user.uid;
      });

      // Remove duplicate IDs.
      ids = ids.filter(function (id, index) {
        return ids.indexOf(id) === index;
      });

      var members = [];

      // Load public profiles in small batches.
      for (var i = 0; i < ids.length; i += 10) {
        var batch = ids.slice(i, i + 10);

        var profiles = await Promise.all(
          batch.map(function (id) {
            return database.collection('publicProfiles')
              .doc(id).get();
          })
        );

        profiles.forEach(function (profile, index) {
          var data = profile.exists ? profile.data() : {};

          members.push({
            id: batch[index],
            name: data.username ||
              data.name ||
              'Afrishine Member',
            avatar: data.photoURL || ''
          });
        });
      }

      if (!modal.classList.contains('open')) return;

      renderMembers(members);

    } catch (error) {
      console.warn('[AH Social List]', error);

      list.innerHTML =
        '<div class="ah-social-empty">' +
        'Unable to load members. Please try again.' +
        '</div>';
    }
  }

  // -----------------------------------------
  // RENDER MEMBERS
  // -----------------------------------------

  function renderMembers(members) {
    var list = getById('ahSocialList');

    if (!members.length) {
      list.innerHTML =
        '<div class="ah-social-empty">No members found.</div>';
      return;
    }

    list.innerHTML = '';

    members.forEach(function (member) {
      var row = document.createElement('div');
      row.className = 'ah-social-row';

      var avatar = document.createElement('div');
      avatar.className = 'ah-social-avatar';

      if (member.avatar) {
        var img = document.createElement('img');

        img.src = member.avatar;
        img.alt = '';
        img.className = 'ah-social-avatar';

        img.onerror = function () {
          var fallback = document.createElement('div');
          fallback.className = 'ah-social-avatar';
          fallback.textContent =
            member.name.charAt(0).toUpperCase() || '?';

          if (row.contains(img)) {
            row.replaceChild(fallback, img);
          }
        };

        avatar = img;

      } else {
        avatar.textContent =
          member.name.charAt(0).toUpperCase() || '?';
      }

      var name = document.createElement('div');
      name.className = 'ah-social-name';
      name.textContent = member.name;

      row.appendChild(avatar);
      row.appendChild(name);

      list.appendChild(row);
    });
  }

  // -----------------------------------------
  // INITIALIZATION
  // -----------------------------------------

  function install() {
    if (initialized) return;
    initialized = true;

    addStyles();
    createModal();
    setupProfileStats();

    // Detect the existing Profile being created.
    var profile = getById('profile');

    if (profile && window.MutationObserver) {
      var observer = new MutationObserver(function () {
        if (getById('ahProfileDashboard')) {
          setupProfileStats();
        }
      });

      observer.observe(profile, {
        childList: true,
        subtree: true
      });
    }

    // Refresh when the existing Profile opens.
    if (typeof window.showPage === 'function') {
      var originalShowPage = window.showPage;

      if (!originalShowPage.__ahSocialWrapped) {
        var wrappedShowPage = function (id) {
          var result = originalShowPage.apply(this, arguments);

          if (id === 'profile') {
            setupProfileStats();

            window.setTimeout(function () {
              refresh();
            }, 100);
          }

          return result;
        };

        wrappedShowPage.__ahSocialWrapped = true;
        window.showPage = wrappedShowPage;
      }
    }

    // Refresh when Firebase authentication changes.
    try {
      if (typeof auth !== 'undefined' &&
          auth &&
          typeof auth.onAuthStateChanged === 'function') {

        auth.onAuthStateChanged(function () {
          window.setTimeout(refresh, 300);
        });
      }
    } catch (e) {}

    // Initial refresh if Profile is already active.
    if (profile && profile.classList.contains('active')) {
      refresh();
    }
  }

  window.AHProfileSocialStats = {
    refresh: refresh,
    openFollowers: function () {
      openList('followers');
    },
    openFollowing: function () {
      openList('following');
    },
    close: closeModal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }

})(window, document);
