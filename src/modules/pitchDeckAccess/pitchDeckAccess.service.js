const PitchDeckAccess = require("./pitchDeckAccess.model");
const User = require("../user/user.model");
const ApiError = require("../../utils/ApiError");

const request = async (investorId, founderId, message) => {
  if (investorId.toString() === founderId.toString()) {
    throw new ApiError(400, "Cannot request from yourself");
  }
  const founder = await User.findById(founderId);
  if (!founder || founder.role !== "founder") {
    throw new ApiError(404, "Founder not found");
  }
  if (!founder.pitchDeck) {
    throw new ApiError(404, "Founder has not uploaded a pitch deck");
  }

  let req = await PitchDeckAccess.findOne({ founderId, investorId });
  if (req && req.status === "approved") return req;
  if (!req) {
    req = await PitchDeckAccess.create({
      founderId,
      investorId,
      message: message || "",
    });
  } else {
    req.status = "pending";
    req.message = message || req.message;
    await req.save();
  }
  // Notify founder
  try {
    const notif = require("../notification/notification.service");
    const investor = await User.findById(investorId).select("name");
    notif
      .send(founderId, {
        type: "system",
        title: `${investor?.name || "An investor"} requested your pitch deck`,
        body: message?.slice(0, 100) || "Tap to approve or deny",
        data: {
          requestId: req._id.toString(),
          investorId: investorId.toString(),
        },
      })
      .catch(() => {});
  } catch {}
  return req;
};

const respond = async (requestId, founderId, approve) => {
  const req = await PitchDeckAccess.findOne({ _id: requestId, founderId });
  if (!req) throw new ApiError(404, "Request not found");
  req.status = approve ? "approved" : "denied";
  req.respondedAt = new Date();
  await req.save();
  try {
    const notif = require("../notification/notification.service");
    notif
      .send(req.investorId, {
        type: "system",
        title: approve
          ? "Pitch deck access approved"
          : "Pitch deck access denied",
        body: approve
          ? "You can now view the founder's pitch deck"
          : "Request was declined",
        data: {
          requestId: req._id.toString(),
          founderId: founderId.toString(),
        },
      })
      .catch(() => {});
  } catch {}
  return req;
};

const getDeck = async (investorId, founderId) => {
  const founder = await User.findById(founderId).select("pitchDeck");
  if (!founder || !founder.pitchDeck) {
    throw new ApiError(404, "Pitch deck not available");
  }
  const access = await PitchDeckAccess.findOne({
    founderId,
    investorId,
    status: "approved",
  });
  if (!access)
    throw new ApiError(403, "Access not approved. Request access first.");
  return { pitchDeck: founder.pitchDeck };
};

const incoming = async (founderId) => {
  return PitchDeckAccess.find({ founderId })
    .sort({ createdAt: -1 })
    .populate("investorId", "name avatar isVerified");
};

const outgoing = async (investorId) => {
  return PitchDeckAccess.find({ investorId })
    .sort({ createdAt: -1 })
    .populate("founderId", "name avatar companyName isVerified");
};

module.exports = { request, respond, getDeck, incoming, outgoing };
