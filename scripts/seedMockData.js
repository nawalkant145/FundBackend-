require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/modules/user/user.model");

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    // 1. Find or create Aisha Kamara
    let aisha = await User.findOne({
      $or: [
        { username: "aisha_kamara" },
        { username: "aishakamara" },
        { name: new RegExp("Aisha Kamara", "i") },
      ],
    });

    if (!aisha) {
      console.log("Creating Aisha Kamara user profile...");
      aisha = await User.create({
        name: "Aisha Kamara",
        username: "aisha_kamara",
        email: "aisha.kamara@expglobusiness.com",
        password: "Password123!",
        role: "founder",
        bio: "Founder & CEO at HealthTech AI. Building affordable healthcare solutions across emerging markets.",
        companyName: "HealthTech AI",
        industry: "Healthcare / AI",
        fundingStage: "seed",
        country: "Sierra Leone",
        avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
        isEmailVerified: true,
        isPhoneVerified: true,
        isVerified: true,
        verificationLevel: 3,
        profileCompleteness: 95,
      });
      console.log("Created Aisha Kamara ID:", aisha._id);
    } else {
      console.log("Found existing Aisha Kamara ID:", aisha._id);
    }

    // 2. Fetch other users to connect as followers / following
    const otherUsers = await User.find({ _id: { $ne: aisha._id } }).limit(10);

    if (otherUsers.length === 0) {
      console.log("No other users found in database to connect.");
    } else {
      // Divide other users: some follow Aisha, Aisha follows some
      const followersForAisha = otherUsers.slice(0, 4);
      const followingForAisha = otherUsers.slice(2, 6);

      const followerIds = followersForAisha.map((u) => u._id);
      const followingIds = followingForAisha.map((u) => u._id);

      // Update Aisha's followers and following
      aisha.followers = followerIds;
      aisha.following = followingIds;
      aisha.followersCount = followerIds.length;
      aisha.followingCount = followingIds.length;
      await aisha.save({ validateBeforeSave: false });

      // Update followers to include Aisha in their following list
      for (const u of followersForAisha) {
        await User.findByIdAndUpdate(u._id, {
          $addToSet: { following: aisha._id },
          $inc: { followingCount: 1 },
        });
      }

      // Update users Aisha follows to include Aisha in their followers list
      for (const u of followingForAisha) {
        await User.findByIdAndUpdate(u._id, {
          $addToSet: { followers: aisha._id },
          $inc: { followersCount: 1 },
        });
      }

      console.log(`Successfully seeded followers & following for Aisha Kamara:`);
      console.log(`- Followers (${aisha.followersCount}):`, followersForAisha.map(u => u.name));
      console.log(`- Following (${aisha.followingCount}):`, followingForAisha.map(u => u.name));
    }

    console.log("Mock data seed complete!");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
