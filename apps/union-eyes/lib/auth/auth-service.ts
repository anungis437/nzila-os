/**
 * Auth Service — re-exports from shared @nzila/platform-auth package.
 * All Nzila apps share the same authentication business logic.
 */
export {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getAuthUser,
  type AuthResult,
  type SignupInput,
  type LoginInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type AuthUser,
} from '@nzila/platform-auth/password'
