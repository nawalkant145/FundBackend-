const mongoose = require("mongoose");
const User = require("../modules/user/user.model");
const DealRoom = require("../modules/dealRoom/dealRoom.model");
const dealRoomService = require("../modules/dealRoom/dealRoom.service");
const Notification = require("../modules/notification/notification.model");

// Mock Notification.create
Notification.create = async (doc) => ({ _id: new mongoose.Types.ObjectId(), ...doc });

async function runTests() {
  console.log("🚀 Starting Deal Room Permission Matrix Tests...\n");

  // Create mock users in memory
  const founderAId = new mongoose.Types.ObjectId();
  const founderBId = new mongoose.Types.ObjectId();
  const investorId = new mongoose.Types.ObjectId();
  const unauthorizedUserId = new mongoose.Types.ObjectId();

  const mockUsers = {
    [founderAId]: { _id: founderAId, role: "founder", name: "Founder A" },
    [founderBId]: { _id: founderBId, role: "founder", name: "Founder B" },
    [investorId]: { _id: investorId, role: "investor", name: "Investor X" },
    [unauthorizedUserId]: { _id: unauthorizedUserId, role: "founder", name: "Unauthorized User" },
  };

  // Mock User.findById
  User.findById = (id) => {
    const u = mockUsers[id.toString()] || null;
    return {
      ...u,
      select: () => u,
    };
  };

  // Mock DealRoom DB operations using in-memory store
  const db = [];
  
  DealRoom.findOne = async (query) => {
    return db.find((item) => {
      let matchesQuery = true;
      if (query.$or) {
        const matchesOr = query.$or.some((cond) => {
          return (
            cond.founderId?.toString() === item.founderId?.toString() &&
            cond.investorId?.toString() === item.investorId?.toString()
          );
        });
        if (!matchesOr) matchesQuery = false;
      }
      if (query.status && query.status.$in) {
        if (!query.status.$in.includes(item.status)) matchesQuery = false;
      }
      return matchesQuery;
    });
  };

  DealRoom.findById = async (id) => {
    const doc = db.find((d) => d._id.toString() === id.toString());
    if (!doc) return null;
    return {
      ...doc,
      save: async function () {
        const idx = db.findIndex((d) => d._id.toString() === doc._id.toString());
        if (idx !== -1) db[idx] = { ...this };
        return this;
      },
    };
  };

  DealRoom.create = async (doc) => {
    const newDoc = {
      _id: new mongoose.Types.ObjectId(),
      ...doc,
      save: async function () {
        const idx = db.findIndex((d) => d._id.toString() === this._id.toString());
        if (idx !== -1) db[idx] = { ...this };
        return this;
      },
    };
    db.push(newDoc);
    return newDoc;
  };

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failedCount++;
    }
  }

  // --- TEST 1: Investor -> Founder (Direct Active) ---
  try {
    const room1 = await dealRoomService.createDealRoom(mockUsers[investorId], {
      founderId: founderAId,
      investorId: investorId,
    });
    assert(room1.status === "active", "TEST 1: Investor -> Founder creates ACTIVE deal room");
  } catch (e) {
    assert(false, `TEST 1 Failed: ${e.message}`);
  }

  // Clear DB
  db.length = 0;

  // --- TEST 2: Founder -> Investor (Pending Acceptance) ---
  let room2;
  try {
    room2 = await dealRoomService.createDealRoom(mockUsers[founderAId], {
      founderId: founderAId,
      investorId: investorId,
    });
    assert(room2.status === "pending_acceptance", "TEST 2: Founder -> Investor creates PENDING_ACCEPTANCE request");
    assert(room2.requestedBy.toString() === founderAId.toString(), "TEST 2: requestedBy is Founder");
    assert(room2.requestedTo.toString() === investorId.toString(), "TEST 2: requestedTo is Investor");
  } catch (e) {
    assert(false, `TEST 2 Failed: ${e.message}`);
  }

  // --- TEST 3: Investor Accepts Request ---
  try {
    const accepted = await dealRoomService.acceptDealRoomRequest(room2._id, mockUsers[investorId]);
    assert(accepted.status === "active", "TEST 3: Target Investor accepts request -> status becomes ACTIVE");
  } catch (e) {
    assert(false, `TEST 3 Failed: ${e.message}`);
  }

  // Clear DB
  db.length = 0;

  // --- TEST 4: Investor Declines Request ---
  try {
    const room4 = await dealRoomService.createDealRoom(mockUsers[founderAId], {
      founderId: founderAId,
      investorId: investorId,
    });
    const declined = await dealRoomService.declineDealRoomRequest(room4._id, mockUsers[investorId]);
    assert(declined.status === "declined", "TEST 4: Target Investor declines request -> status becomes DECLINED");
  } catch (e) {
    assert(false, `TEST 4 Failed: ${e.message}`);
  }

  // Clear DB
  db.length = 0;

  // --- TEST 5: Founder -> Founder (Direct Active) ---
  try {
    const room5 = await dealRoomService.createDealRoom(mockUsers[founderAId], {
      founderId: founderAId,
      investorId: founderBId,
      targetId: founderBId,
    });
    assert(room5.status === "active", "TEST 5: Founder -> Founder creates ACTIVE deal room");
  } catch (e) {
    assert(false, `TEST 5 Failed: ${e.message}`);
  }

  // Clear DB
  db.length = 0;

  // --- TEST 6: Security Bypass Check (Founder sending status="active") ---
  try {
    const room6 = await dealRoomService.createDealRoom(mockUsers[founderAId], {
      founderId: founderAId,
      investorId: investorId,
      status: "active", // Attacker attempt to bypass
    });
    assert(room6.status === "pending_acceptance", "TEST 6: Client-supplied status='active' is IGNORED by backend");
  } catch (e) {
    assert(false, `TEST 6 Failed: ${e.message}`);
  }

  // --- TEST 7: Unauthorized User (Founder) tries to accept request ---
  try {
    const reqRoom = await DealRoom.findOne({ status: "pending_acceptance" });
    await dealRoomService.acceptDealRoomRequest(reqRoom._id, mockUsers[founderAId]);
    assert(false, "TEST 7: Requesting founder was allowed to accept (SHOULD FAIL)");
  } catch (e) {
    assert(e.statusCode === 403, `TEST 7: Requesting founder acceptance blocked with 403 Forbidden ("${e.message}")`);
  }

  // --- TEST 8: Unauthorized User tries to decline request ---
  try {
    const reqRoom = await DealRoom.findOne({ status: "pending_acceptance" });
    await dealRoomService.declineDealRoomRequest(reqRoom._id, mockUsers[unauthorizedUserId]);
    assert(false, "TEST 8: Unauthorized user was allowed to decline (SHOULD FAIL)");
  } catch (e) {
    assert(e.statusCode === 403, `TEST 8: Unauthorized decline blocked with 403 Forbidden ("${e.message}")`);
  }

  // --- TEST 9: Duplicate Active Deal Room ---
  db.length = 0;
  try {
    await dealRoomService.createDealRoom(mockUsers[investorId], {
      founderId: founderAId,
      investorId: investorId,
    });
    const countBefore = db.length;
    const dupRoom = await dealRoomService.createDealRoom(mockUsers[investorId], {
      founderId: founderAId,
      investorId: investorId,
    });
    assert(db.length === countBefore, "TEST 9: Duplicate active room request does NOT create duplicate DB document");
    assert(dupRoom.status === "active", "TEST 9: Returns existing active deal room");
  } catch (e) {
    assert(false, `TEST 9 Failed: ${e.message}`);
  }

  // --- TEST 10: Duplicate Pending Request ---
  db.length = 0;
  try {
    await dealRoomService.createDealRoom(mockUsers[founderAId], {
      founderId: founderAId,
      investorId: investorId,
    });
    const countBefore = db.length;
    const dupPending = await dealRoomService.createDealRoom(mockUsers[founderAId], {
      founderId: founderAId,
      investorId: investorId,
    });
    assert(db.length === countBefore, "TEST 10: Duplicate pending request does NOT create duplicate DB document");
    assert(dupPending.status === "pending_acceptance", "TEST 10: Returns existing pending request");
  } catch (e) {
    assert(false, `TEST 10 Failed: ${e.message}`);
  }

  console.log(`\n📊 Test Summary: ${passedCount} PASSED, ${failedCount} FAILED.`);
  if (failedCount > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error("Test runner crash:", e);
  process.exit(1);
});
