                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         

const mongoose = require("mongoose");

                                                                               

                                                                                                                                                                                                                       
const toObjectId = (id) => {
  if (!id) return id;
  if (id instanceof mongoose.Types.ObjectId) return id;
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(String(id))
    : id;
};

                                                                                                                                                 
const userInArray = (arr, userId) => {
  if (!arr || !arr.length || !userId) return false;
  const target = userId.toString();
  return arr.some((id) => id && id.toString() === target);
};

                                                                               

                                                                                                                                                                         
const enrichPost = (post, viewerId) => {
  if (!post) return post;
  return {
    ...post,
    isLiked: userInArray(post.likes, viewerId),
    isSaved: userInArray(post.saves, viewerId),
    likeCount: (post.likes || []).length,
    saveCount: (post.saves || []).length,
  };
};

                                             
const enrichPosts = (posts, viewerId) => {
  if (!posts || !posts.length) return posts || [];
  return posts.map((p) => enrichPost(p, viewerId));
};

                                                                               

                                                                                                                                                                                                                        
const enrichVideo = (video, viewerId) => {
  if (!video) return video;
  return {
    ...video,
    isLiked: userInArray(video.likes, viewerId),
    isSaved: userInArray(video.saves, viewerId),
    likeCount: (video.likes || []).length,
    saveCount: (video.saves || []).length,
  };
};

                                              
const enrichVideos = (videos, viewerId) => {
  if (!videos || !videos.length) return videos || [];
  return videos.map((v) => enrichVideo(v, viewerId));
};
                                                                               

                                                                                                                                    
const enrichComment = (comment, viewerId) => {
  if (!comment) return comment;
  return {
    ...comment,
    isLiked: userInArray(comment.likes, viewerId),
    likeCount: (comment.likes || []).length,
    replyCount: comment.replyCount || 0,
  };
};

                                                
const enrichComments = (comments, viewerId) => {
  if (!comments || !comments.length) return comments || [];
  return comments.map((c) => enrichComment(c, viewerId));
};

module.exports = {
  toObjectId,
  userInArray,
  enrichPost,
  enrichPosts,
  enrichVideo,
  enrichVideos,
  enrichComment,
  enrichComments,
};
