/* ==================================================
   AFRISHINE HUB — SOCIAL FEED
   Posts, Likes, Comments, Follow
   Your Hub, Your Solutions
   ================================================== */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  limit
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

import { db } from "./firebase.js";


const AfrishineFeed = {

  // ================================================
  // 1. DESTINATIONS
  // ================================================

  destinations: [
    "home",
    "talent",
    "afrishine"
  ],


  // ================================================
  // 2. CREATE POST
  // ================================================

  async createPost(postData) {

    if (!window.currentUser) {
      window.AfrishineApp.requireLogin("create-post");
      return false;
    }

    const text = String(postData.text || "").trim();

    const destinations = Array.isArray(postData.destinations)
      ? [...new Set(postData.destinations)]
      : [];

    if (!text && !postData.mediaUrl) {
      throw new Error("Write something or add media first.");
    }

    if (destinations.length === 0) {
      throw new Error("Choose where your post should appear.");
    }

    const validDestinations = destinations.every(
      item => this.destinations.includes(item)
    );

    if (!validDestinations) {
      throw new Error("Invalid post destination.");
    }

    const user = window.currentUser;

    const post = {
      text,
      mediaUrl: postData.mediaUrl || null,
      mediaType: postData.mediaType || "text",

      authorId: user.uid,
      authorName:
        user.displayName ||
        user.username ||
        "Afrishine Member",

      provider: user.provider || "email",

      visibility: "public",
      destinations,

      likes: [],
      commentsCount: 0,

      createdAt: serverTimestamp()
    };

    const result = await addDoc(
      collection(db, "posts"),
      post
    );

    return result.id;
  },


  // ================================================
  // 3. LOAD PUBLIC POSTS
  // ================================================

  async loadPosts(destination = "home") {

    if (!this.destinations.includes(destination)) {
      throw new Error("Unknown feed destination.");
    }

    const postsQuery = query(
      collection(db, "posts"),
      where("visibility", "==", "public"),
      where("destinations", "array-contains", destination),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const snapshot = await getDocs(postsQuery);

    return snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));
  },


  // ================================================
  // 4. LIKE A POST
  // ================================================

  async toggleLike(postId) {

    if (!window.currentUser) {
      window.AfrishineApp.requireLogin("like");
      return false;
    }

    const userId = window.currentUser.uid;

    const postRef = doc(db, "posts", postId);

    const snapshot = await getDocs(
      query(
        collection(db, "posts"),
        where("__name__", "==", postId),
        limit(1)
      )
    );

    if (snapshot.empty) {
      throw new Error("Post not found.");
    }

    const post = snapshot.docs[0].data();

    const alreadyLiked =
      Array.isArray(post.likes) &&
      post.likes.includes(userId);

    await updateDoc(postRef, {
      likes: alreadyLiked
        ? arrayRemove(userId)
        : arrayUnion(userId)
    });

    return !alreadyLiked;
  },


  // ================================================
  // 5. ADD COMMENT
  // ================================================

  async addComment(postId, commentText) {

    if (!window.currentUser) {
      window.AfrishineApp.requireLogin("comment");
      return false;
    }

    const text = String(commentText || "").trim();

    if (!text) {
      throw new Error("Comment cannot be empty.");
    }

    const user = window.currentUser;

    await addDoc(
      collection(db, "posts", postId, "comments"),
      {
        text,

        authorId: user.uid,

        authorName:
          user.displayName ||
          user.username ||
          "Afrishine Member",

        createdAt: serverTimestamp()
      }
    );

    const postRef = doc(db, "posts", postId);

    // Increment comments count
    const postSnapshot = await getDocs(
      query(
        collection(db, "posts"),
        where("__name__", "==", postId),
        limit(1)
      )
    );

    if (!postSnapshot.empty) {
      const currentCount =
        postSnapshot.docs[0].data().commentsCount || 0;

      await updateDoc(postRef, {
        commentsCount: currentCount + 1
      });
    }

    return true;
  },


  // ================================================
  // 6. LOAD COMMENTS
  // ================================================

  async loadComments(postId) {

    const commentsQuery = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc"),
      limit(100)
    );

    const snapshot = await getDocs(commentsQuery);

    return snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));
  },


  // ================================================
  // 7. FOLLOW CREATOR
  // ================================================

  async followCreator(creatorId) {

    if (!window.currentUser) {
      window.AfrishineApp.requireLogin("follow");
      return false;
    }

    const userId = window.currentUser.uid;

    if (userId === creatorId) {
      throw new Error("You cannot follow yourself.");
    }

    const followingRef = doc(
      db,
      "users",
      userId,
      "following",
      creatorId
    );

    const result = await getDocs(
      query(
        collection(db, "users", userId, "following"),
        where("__name__", "==", creatorId),
        limit(1)
      )
    );

    if (!result.empty) {
      await import(
        "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js"
      ).then(module =>
        module.deleteDoc(followingRef)
      );

      return false;
    }

    await addDoc(
      collection(db, "users", userId, "following"),
      {
        creatorId,
        createdAt: serverTimestamp()
      }
    );

    return true;
  }

};


// ================================================
// 8. MAKE AVAILABLE TO OTHER FILES
// ================================================

window.AfrishineFeed = AfrishineFeed;

export default AfrishineFeed;

console.log("Afrishine Hub Feed module loaded.");