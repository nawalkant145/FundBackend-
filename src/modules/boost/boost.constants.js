// Server-side source of truth for boost pricing.
// The client display prices must match these; the server NEVER trusts a
// client-supplied price — it looks the tier up here.
const BOOST_TIERS = {
  mini: {
    id: "mini",
    name: "Mini Boost",
    price: 499, // INR
    durationHours: 24,
  },
  pro: {
    id: "pro",
    name: "Pro Boost",
    price: 1499,
    durationHours: 24 * 7,
  },
  mega: {
    id: "mega",
    name: "Mega Boost",
    price: 4999,
    durationHours: 24 * 30,
  },
};

module.exports = { BOOST_TIERS };
