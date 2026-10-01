import { effectivePlanId, isInTrial, trialEndsAt } from "../config/plans";
// ============================================================================
// HELPERS
// ============================================================================
// `photo`/`companyLogo` are data: URIs stored straight in the DB — some are
// multiple MB of base64. userPublic() is embedded in the login/signup/me/
// refresh response and re-fetched on every window focus (useAutoRefreshUser),
// so shipping the raw bytes there made every auth check multi-megabyte. Only
// a boolean flag goes out here; the actual image is fetched once, on demand,
// from GET /api/auth/photo by whichever screen renders an <img>.
export const userPublic = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  blocked: u.blocked,
  hasPhoto: !!u.photo,
  plan: u.plan,
  effectivePlan: effectivePlanId(u),
  trialEndsAt: u.plan === "FREE" && isInTrial(u) ? trialEndsAt(u) : null,
  transactionsUsed: u.transactionsUsed,
  stripeCustomerId: u.stripeCustomerId,
  stripeSubscriptionId: u.stripeSubscriptionId,
  planExpiresAt: u.planExpiresAt,
  hasCompletedOnboarding: u.hasCompletedOnboarding,
  usageType: u.usageType,
  companyName: u.companyName,
  hasCompanyLogo: !!u.companyLogo,
  businessPurpose: u.businessPurpose,
  primaryColor: u.primaryColor,
  isVerified: u.isVerified,
  createdAt: u.createdAt,
});
