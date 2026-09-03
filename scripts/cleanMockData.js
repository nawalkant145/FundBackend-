require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/modules/user/user.model");

async function clean() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI env variable is missing.");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for mock data inspection.");

                                                                 
    const exactMockQuery = {
      $or: [
        { email: "aisha.kamara@expglobusiness.com" },
        { username: "aisha_kamara" },
        { username: "aishakamara" },
      ],
    };

    const mockUsers = await User.find(exactMockQuery);

    console.log(`\nFound ${mockUsers.length} mock user record(s) matching exact seed credentials:`);
    mockUsers.forEach((u) => {
      console.log(`- ID: ${u._id} | Name: ${u.name} | Username: ${u.username} | Email: ${u.email}`);
    });

    if (mockUsers.length === 0) {
      console.log("\nNo mock seed users found in the database.");
    }

                                                           
    const mockUserIds = mockUsers.map((u) => u._id);
    let affectedRelationshipCount = 0;

    if (mockUserIds.length > 0) {
      const usersWithRefs = await User.find({
        $or: [
          { followers: { $in: mockUserIds } },
          { following: { $in: mockUserIds } },
        ],
      });
      affectedRelationshipCount = usersWithRefs.length;
      console.log(`Found ${affectedRelationshipCount} user record(s) with follower/following links to mock user(s).`);
    }

                                
    if (process.env.CLEAN_MOCK_DATA !== "true") {
      console.log("\nNo data deleted.");
      console.log("Set CLEAN_MOCK_DATA=true to confirm cleanup.");
      return;
    }

                                                                        
    let usersDeleted = 0;
    let relationshipsDeleted = 0;

    if (mockUserIds.length > 0) {
                                                                                   
      const relResult = await User.updateMany(
        {
          $or: [
            { followers: { $in: mockUserIds } },
            { following: { $in: mockUserIds } },
          ],
        },
        {
          $pullAll: {
            followers: mockUserIds,
            following: mockUserIds,
          },
        }
      );
      relationshipsDeleted = relResult.modifiedCount || 0;

                                                                         
      const affectedUsers = await User.find({
        _id: { $nin: mockUserIds },
      });
      for (const u of affectedUsers) {
        const actualFollowersCount = (u.followers || []).length;
        const actualFollowingCount = (u.following || []).length;
        if (u.followersCount !== actualFollowersCount || u.followingCount !== actualFollowingCount) {
          u.followersCount = actualFollowersCount;
          u.followingCount = actualFollowingCount;
          await u.save({ validateBeforeSave: false });
        }
      }

                                    
      const delResult = await User.deleteMany({ _id: { $in: mockUserIds } });
      usersDeleted = delResult.deletedCount || 0;
    }

    console.log("\nMock data cleanup completed.");
    console.log(`Users deleted: ${usersDeleted}`);
    console.log(`Relationships deleted: ${relationshipsDeleted}`);
  } catch (err) {
    console.error("Cleanup error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

clean();
