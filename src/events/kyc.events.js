const EventEmitter = require("events");
const User = require("../modules/user/user.model");
const notificationService = require("../modules/notification/notification.service");
const { sendEmail } = require("../utils/sendEmail");
const auditService = require("../modules/audit/audit.service");

class KycEventEmitter extends EventEmitter {}
const kycEvents = new KycEventEmitter();

// Level 2 Personal Identity Submitted
kycEvents.on("kyc:submitted", async ({ userId, kycId, referenceId }) => {
  try {
    await notificationService.send(userId, {
      type: "verification",
      title: "KYC Submission Received 📄",
      body: `Your identity verification request has been received. Reference ID: ${referenceId || "KYC-REQ"}. Estimated review within 24 hours.`,
      data: { level: 2, status: "under_review", referenceId },
    });
  } catch (err) {
    console.error("Error in kyc:submitted handler:", err);
  }
});

// Level 2 Personal Identity Resubmitted
kycEvents.on("kyc:resubmitted", async ({ userId, kycId, referenceId }) => {
  try {
    await notificationService.send(userId, {
      type: "verification",
      title: "KYC Resubmission Under Review ⏳",
      body: `Your updated documents for Reference ID: ${referenceId || "KYC-REQ"} are under review by our compliance team.`,
      data: { level: 2, status: "under_review", referenceId },
    });
  } catch (err) {
    console.error("Error in kyc:resubmitted handler:", err);
  }
});

// Level 2 Personal Identity Approved
kycEvents.on("kyc:approved", async ({ userId, adminId }) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.kycStatus = "approved";
    user.documents.status = "approved";
    user.documents.reviewedAt = new Date();
    user.recomputeVerificationLevel();
    await user.save({ validateBeforeSave: false });

    await notificationService.send(userId, {
      type: "verification",
      title: "Identity Verified (Level 2) 🎉",
      body: "Your identity has been verified! You've received the Blue Verified Badge.",
      data: { level: 2, badge: true },
    });

    await sendEmail({
      to: user.email,
      subject: "EXPGLO — Identity Verification Approved",
      html: `<h2>Congratulations ${user.name}!</h2><p>Your identity documents have been approved. Your account now features the Blue Verified Badge.</p>`,
    }).catch(() => {});

    await auditService.log({
      actorId: adminId,
      action: "APPROVE_PERSONAL_KYC",
      targetType: "User",
      targetId: userId,
    });
  } catch (err) {
    console.error("Error in kyc:approved handler:", err);
  }
});

// Level 2 Personal Identity Rejected
kycEvents.on("kyc:rejected", async ({ userId, reason, adminId }) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.kycStatus = "rejected";
    user.documents.status = "rejected";
    user.documents.rejectionReason = reason || "Document verification failed.";
    user.recomputeVerificationLevel();
    await user.save({ validateBeforeSave: false });

    await notificationService.send(userId, {
      type: "verification",
      title: "KYC Documents Rejected",
      body: reason || "Please resubmit clear copies of your ID documents.",
      data: { level: 2, reason },
    });

    await sendEmail({
      to: user.email,
      subject: "EXPGLO — KYC Verification Update",
      html: `<p>Your KYC document verification required update: ${reason || "Please resubmit clear documents."}</p>`,
    }).catch(() => {});

    await auditService.log({
      actorId: adminId,
      action: "REJECT_PERSONAL_KYC",
      targetType: "User",
      targetId: userId,
      metadata: { reason },
    });
  } catch (err) {
    console.error("Error in kyc:rejected handler:", err);
  }
});

// Level 3 Founder Verification Approved
kycEvents.on("company:approved", async ({ userId, companyId, adminId }) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.companyVerificationStatus = "approved";
    user.recomputeVerificationLevel();
    await user.save({ validateBeforeSave: false });

    await notificationService.send(userId, {
      type: "verification",
      title: "Founder Verification Approved (Level 3) 🚀",
      body: "Your startup profile is verified! You can now publish startups and video pitches.",
      data: { level: 3, companyId: companyId ? companyId.toString() : "" },
    });

    await sendEmail({
      to: user.email,
      subject: "EXPGLO — Founder Verification Approved",
      html: `<h2>Company Verified!</h2><p>Your company registration documents have been approved. You are now authorized to publish startups.</p>`,
    }).catch(() => {});

    await auditService.log({
      actorId: adminId,
      action: "APPROVE_COMPANY_KYC",
      targetType: "User",
      targetId: userId,
      metadata: { companyId },
    });
  } catch (err) {
    console.error("Error in company:approved handler:", err);
  }
});

// Level 4 Investor Transaction KYC Approved
kycEvents.on("investmentKyc:approved", async ({ userId, adminId }) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.investmentVerificationStatus = "approved";
    user.recomputeVerificationLevel();
    await user.save({ validateBeforeSave: false });

    await notificationService.send(userId, {
      type: "verification",
      title: "Investor Verification Approved (Level 4) 💼",
      body: "Your investment KYC is complete. You can now initiate investments and sign deals.",
      data: { level: 4 },
    });

    await sendEmail({
      to: user.email,
      subject: "EXPGLO — Investor Verification Approved",
      html: `<h2>Investment KYC Cleared!</h2><p>Your bank and address verification are complete. You may now invest in startups on EXPGLO.</p>`,
    }).catch(() => {});

    await auditService.log({
      actorId: adminId,
      action: "APPROVE_INVESTOR_KYC",
      targetType: "User",
      targetId: userId,
    });
  } catch (err) {
    console.error("Error in investmentKyc:approved handler:", err);
  }
});

module.exports = kycEvents;
