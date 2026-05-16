// Plan catalog + server-enforced limits. The pure client-side compressor
// is always free (it's the viral funnel and can't be gated anyway —
// it's open source). Paid tiers unlock ACCOUNT-level value that only a
// server can provide: saved prompt libraries, history, team seats, and
// a hosted compression API.
export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    priceInr: 0,
    savedPrompts: 5,
    teamSeats: 1,
    apiAccess: false,
    blurb: "Full client-side compressor, 5 saved prompts.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 9,
    priceInr: 749,
    savedPrompts: 500,
    teamSeats: 1,
    apiAccess: true,
    blurb: "Unlimited history, 500 saved prompts, hosted API.",
  },
  team: {
    id: "team",
    name: "Team",
    priceUsd: 29,
    priceInr: 2499,
    savedPrompts: 5000,
    teamSeats: 10,
    apiAccess: true,
    blurb: "Everything in Pro + 10 seats and shared libraries.",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceUsd: null, // contact sales / manual grant
    priceInr: null,
    savedPrompts: 1000000,
    teamSeats: 1000,
    apiAccess: true,
    blurb: "Custom seats, SSO, invoicing. Granted manually by admin.",
  },
};

export function planOf(user) {
  const p = PLANS[user?.plan] || PLANS.free;
  // Expired paid plan falls back to free.
  if (user?.plan_until && user.plan_until < Math.floor(Date.now() / 1000)) {
    return PLANS.free;
  }
  if (user?.plan_status && user.plan_status !== "active") return PLANS.free;
  return p;
}

export function enforce(user, feature) {
  const p = planOf(user);
  return p[feature];
}
