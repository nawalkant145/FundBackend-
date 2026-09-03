                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            

require("dotenv").config();
const connectDB = require("../src/config/db");
const mongoose = require("mongoose");
const User = require("../src/modules/user/user.model");
const signupSessionService = require("../src/modules/auth/signupSession.service");
const authService = require("../src/modules/auth/auth.service");
const dealRoomService = require("../src/modules/dealRoom/dealRoom.service");
const DealRoom = require("../src/modules/dealRoom/dealRoom.model");

function pass(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { throw new Error(`FAILED: ${msg}`); }

async function runTests() {
  console.log("Starting EXPGLO FUND signup flow & security tests (20 tests)...");
  await connectDB();

  const r = Math.floor(100000 + Math.random() * 900000);
  const fEmail = `founder_${r}@example.com`;
  const fUser = `fdr${r}`;
  const fPhone = `+919876${r}`;

  const iEmail = `investor_${r}@example.com`;
  const iUser = `inv${r}`;
  const iPhone = `+918765${r}`;

  let founderSignupSessionId, investorSignupSessionId;
  let founderUser, investorUser;

  const founderPayload = {
    name: "Founder Test",
    username: fUser,
    email: fEmail,
    password: "Password123!",
    role: "founder",
    phone: fPhone,
    country: "IN",
    companyName: "Startup One",
    industry: "FinTech",
    fundingStage: "seed",
  };

  const investorPayload = {
    name: "Investor Test",
    username: iUser,
    email: iEmail,
    password: "Password123!",
    role: "investor",
    phone: iPhone,
    country: "IN",
    investorType: "angel",
    investmentRange: { min: 100000, max: 500000 },
    preferredIndustries: ["FinTech", "AI"],
    preferredStages: ["seed"],
    investmentThesis: "Early-stage fintech",
  };

  try {
                                                                                
                                                                            
                                                                                
    console.log("\n[Test 1] Founder signup initiation — returns signupSessionId, no User created...");
    const { signupSessionId: sid1, expiresAt: ea1 } = await signupSessionService.createSession(founderPayload);
    if (!sid1 || typeof sid1 !== "string" || sid1.length < 32) fail("signupSessionId missing or too short");
    if (!ea1) fail("expiresAt missing");
    founderSignupSessionId = sid1;
    const noUserYet = await User.findOne({ email: fEmail });
    if (noUserYet) fail("Permanent User was created before identity verification!");
    pass(`signupSessionId returned (${sid1.slice(0,8)}…), no User in MongoDB`);

                                                                                
                                                
                                                                                
    console.log("\n[Test 2] Duplicate email on second initiate → 409...");
                                                             
                                                                                                             
                                                                                            
    const tempUser = await User.create({
      name: "Temp", username: `tmp${r}`, email: `tmp${r}@example.com`,
      password: "Password123!", role: "founder",
      emailVerified: false, phoneVerified: false, identityVerified: false,
    });
    try {
      await signupSessionService.createSession({ ...founderPayload, email: `tmp${r}@example.com`, username: `xtmp${r}` });
      fail("Duplicate email in permanent DB was not rejected.");
    } catch (e) {
      if (e.statusCode === 409) pass("Duplicate email (permanent DB) rejected with 409");
      else throw e;
    } finally {
      await User.deleteOne({ _id: tempUser._id });
    }

                                                                                
                                                   
                                                                                
    console.log("\n[Test 3] Duplicate username on initiate → 409...");
    const tempUser2 = await User.create({
      name: "Temp2", username: `tmpx${r}`, email: `tmpx${r}@example.com`,
      password: "Password123!", role: "founder",
      emailVerified: false, phoneVerified: false, identityVerified: false,
    });
    try {
      await signupSessionService.createSession({ ...founderPayload, username: `tmpx${r}`, email: `unique${r}@example.com` });
      fail("Duplicate username in permanent DB was not rejected.");
    } catch (e) {
      if (e.statusCode === 409) pass("Duplicate username rejected with 409");
      else throw e;
    } finally {
      await User.deleteOne({ _id: tempUser2._id });
    }

                                                                                
                                                       
                                                                                
    console.log("\n[Test 4] getSession → retrieved correctly...");
    const session = await signupSessionService.getSession(founderSignupSessionId);
    if (session.accountData.email !== fEmail.toLowerCase()) fail("Session email mismatch");
    if (session.role !== "founder") fail("Session role mismatch");
    if (!session.accountData.passwordHash || !session.accountData.passwordHash.startsWith("$2")) fail("Password not hashed in session");
    if (session.accountData.passwordHash === "Password123!") fail("Plaintext password stored in session!");
    pass("Session retrieved, email correct, password is bcrypt hash");

                                                                                
                                                          
                                                                                
    console.log("\n[Test 5] No User in MongoDB during session phase...");
    const noUser = await User.findOne({ email: fEmail });
    if (noUser) fail("User was created before finalization!");
    pass("Confirmed no User in MongoDB during signup session phase");

                                                                                
                                                                           
                                                                                
    console.log("\n[Test 6] Investor signup initiation → signupSessionId, no User...");
    const { signupSessionId: sid2 } = await signupSessionService.createSession(investorPayload);
    if (!sid2) fail("Investor signupSessionId missing");
    investorSignupSessionId = sid2;
    const noInvestorYet = await User.findOne({ email: iEmail });
    if (noInvestorYet) fail("Investor User created before verification!");
    pass(`Investor signupSessionId returned (${sid2.slice(0,8)}…), no User in MongoDB`);

                                                                                
                                                                                             
                                                                                
    console.log("\n[Test 7] Finalize Founder account — identityVerified=true, verificationLevel=1...");
    const founderResult = await signupSessionService.finalizeAccountCreation(founderSignupSessionId);
    if (!founderResult.user) fail("No user returned from finalization");
    if (!founderResult.accessToken) fail("No accessToken after finalization");
    if (!founderResult.refreshToken) fail("No refreshToken after finalization");
    founderUser = await User.findOne({ email: fEmail });
    if (!founderUser) fail("Founder User not in MongoDB after finalization");
    if (!founderUser.identityVerified) fail("identityVerified not set to true");
    if (founderUser.verificationLevel < 1) fail("verificationLevel not set to 1");
    if (founderUser.kycStatus !== "approved") fail("kycStatus not approved");
    pass(`Founder User created (${founderUser._id}), identityVerified=true, verificationLevel=${founderUser.verificationLevel}`);

                                                                                
                                                                                   
                                                                                
    console.log("\n[Test 8] emailVerified/phoneVerified remain false after identity verification...");
    if (founderUser.emailVerified !== false) fail("emailVerified should be false");
    if (founderUser.phoneVerified !== false) fail("phoneVerified should be false");
    pass("emailVerified=false, phoneVerified=false — identity verification does not imply email/phone verification");

                                                                                
                                                                      
                                                                                
    console.log("\n[Test 9] kycStatus=approved, verifiedBadge=true...");
    if (!founderUser.verifiedBadge) fail("verifiedBadge not set");
    if (!founderUser.isVerified) fail("isVerified not set");
    pass("kycStatus=approved, verifiedBadge=true, isVerified=true");

                                                                                
                                                                        
                                                                                
    console.log("\n[Test 10] Finalize Investor account → identityVerified=true...");
    const investorResult = await signupSessionService.finalizeAccountCreation(investorSignupSessionId);
    investorUser = await User.findOne({ email: iEmail });
    if (!investorUser) fail("Investor User not created after finalization");
    if (!investorUser.identityVerified) fail("Investor identityVerified not true");
    pass(`Investor User created (${investorUser._id}), identityVerified=true`);

                                                                                
                                                    
                                                                                
    console.log("\n[Test 11] Redis session deleted after finalize...");
    try {
      await signupSessionService.getSession(founderSignupSessionId);
      fail("Session still exists after finalization — should be deleted");
    } catch (e) {
      if (e.statusCode === 410) pass("Session correctly deleted after finalization (410 on lookup)");
      else throw e;
    }

                                                                                
                                                               
                                                                                
    console.log("\n[Test 12] Second finalize call → 410 (session already consumed)...");
    try {
      await signupSessionService.finalizeAccountCreation(founderSignupSessionId);
      fail("Second finalize call did not throw");
    } catch (e) {
      if (e.statusCode === 410) pass("Second finalize correctly returned 410");
      else throw e;
    }

                                                                                
                                                                    
                                                                                
    console.log("\n[Test 13] Unknown signupSessionId → 410 SIGNUP_SESSION_EXPIRED...");
    try {
      await signupSessionService.getSession("nonexistent_session_id_000000");
      fail("Unknown session did not throw");
    } catch (e) {
      if (e.statusCode === 410 && e.errors?.code === "SIGNUP_SESSION_EXPIRED") {
        pass("Unknown session correctly returned 410 with SIGNUP_SESSION_EXPIRED code");
      } else {
        throw e;
      }
    }

                                                                                
                                                                 
                                                                                
    console.log("\n[Test 14] Unverified user → Deal Room 403 IDENTITY_VERIFICATION_REQUIRED...");
    const unverifiedUser = await User.create({
      name: "Unverified User",
      username: `unv${r}`,
      email: `unv${r}@example.com`,
      password: "Password123!",
      role: "founder",
      emailVerified: false,
      phoneVerified: false,
      identityVerified: false,
      verificationLevel: 0,
    });
    try {
      await dealRoomService.createDealRoom(unverifiedUser, {
        targetId: investorUser._id,
        fundingAmount: 500000,
        equityPercentage: 5,
      });
      fail("Unverified user allowed to create Deal Room!");
    } catch (e) {
      if (e.statusCode === 403 && (e.errors?.code === "IDENTITY_VERIFICATION_REQUIRED" || e.message.includes("Identity Verification required"))) {
        pass("Unverified user blocked from Deal Room with 403 IDENTITY_VERIFICATION_REQUIRED");
      } else {
        throw e;
      }
    } finally {
      await User.deleteOne({ _id: unverifiedUser._id });
    }

                                                                                
                                                                  
                                                                                
    console.log("\n[Test 15] Finalized Founder creates Deal Room → pending_acceptance...");
    const dbFounder = await User.findById(founderUser._id);
    const dbInvestor = await User.findById(investorUser._id);
    const room = await dealRoomService.createDealRoom(dbFounder, {
      targetId: dbInvestor._id,
      fundingAmount: 500000,
      equityPercentage: 5,
    });
    if (room.status !== "pending_acceptance") fail(`Expected pending_acceptance, got ${room.status}`);
    pass(`Deal Room created with status: ${room.status}`);

                                                                                
                                                             
                                                                                
    console.log("\n[Test 16] Finalized Investor accepts Deal Room → active...");
    const accepted = await dealRoomService.acceptDealRoomRequest(room._id, dbInvestor);
    if (accepted.status !== "active") fail(`Expected active, got ${accepted.status}`);
    pass(`Deal Room accepted with status: ${accepted.status}`);

                                                                                
                                                      
                                                                                
    console.log("\n[Test 17] Login with finalized Founder...");
    const founderLogin = await authService.loginUser({ identifier: fEmail, password: "Password123!" });
    if (!founderLogin.accessToken) fail("Founder login did not return accessToken");
    pass(`Founder login success. User ID: ${founderLogin.user._id}`);

                                                                                
                                                       
                                                                                
    console.log("\n[Test 18] Login with finalized Investor...");
    const investorLogin = await authService.loginUser({ identifier: iEmail, password: "Password123!" });
    if (!investorLogin.accessToken) fail("Investor login did not return accessToken");
    pass(`Investor login success. User ID: ${investorLogin.user._id}`);

                                                                                
                                                                         
                                                                                
    console.log("\n[Test 19] Password comparison — bcrypt hash not re-hashed...");
    const freshFounder = await User.findById(founderUser._id).select("+password");
    const pwMatch = await freshFounder.comparePassword("Password123!");
    if (!pwMatch) fail("comparePassword returned false — password was double-hashed or corrupted");
    pass("comparePassword returned true — password correctly stored as single bcrypt hash");

                                                                                
                                                                             
                                                                                
    console.log("\n[Test 20] Zero-trust — identityVerified=true from client is ignored by signupSession.service...");
    const { signupSessionId: zeroTrustSid } = await signupSessionService.createSession({
      ...founderPayload,
      username: `zt${r}`,
      email: `zt${r}@example.com`,
      phone: `+919900${r}`,
                                                               
      identityVerified: true,
      verificationLevel: 99,
    });
    const zeroTrustSession = await signupSessionService.getSession(zeroTrustSid);
                                                                                 
    if (zeroTrustSession.identityVerified === true) fail("Session stored identityVerified=true from client!");
    if (zeroTrustSession.identityVerificationStatus !== "pending") fail("Session identityVerificationStatus should be 'pending'");
               
    await signupSessionService.deleteSession(zeroTrustSid);
    pass("Client-supplied identityVerified=true was NOT stored in session (identityVerificationStatus=pending)");

    console.log("\n🎉 ALL 20 TESTS PASSED SUCCESSFULLY!");
  } finally {
              
    await User.deleteMany({ email: { $in: [fEmail, iEmail] } });
    await DealRoom.deleteMany({ $or: [{ founderId: founderUser?._id }, { investorId: investorUser?._id }] }).catch(() => {});
    await mongoose.connection.close();
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST FAILED:", err.message || err);
  process.exit(1);
});
