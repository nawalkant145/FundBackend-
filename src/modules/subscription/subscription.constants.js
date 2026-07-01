// Server-side source of truth for subscription pricing.
// Investor Pro and Founder (Studio) Pro have different prices.
const PLANS = {
  investor: { id: "investor-pro", name: "Investor Pro", price: 499 },
  founder: { id: "founder-pro", name: "Studio Pro", price: 299 },
};

const DURATION_DAYS = 30;

// Free investors get this many NEW conversations per month before the paywall.
const FREE_CHATS_PER_MONTH = 1;

const planForRole = (role) => PLANS[role] || PLANS.investor;

module.exports = { PLANS, DURATION_DAYS, FREE_CHATS_PER_MONTH, planForRole };
