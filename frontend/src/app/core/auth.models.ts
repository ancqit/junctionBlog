/** Shared character-map PIN charset (must match junctionBack BLOG_PIN_CHARSET). */
export const BLOG_PIN_LENGTH = 4;

export const BLOG_PIN_CHARSET_FALLBACK = [
  ...'ABCDEFGHJKLMNPQRSTUVWXYZ',
  ...'23456789',
  ...'@#$%&*+=',
  ...'★◆●▲■♥☀⚡',
].map(String);

export interface CharsetResponse {
  characters: string[];
  pin_length: number;
}

export interface BlogAuthUser {
  id: string;
  phone_number: string;
  display_name: string;
  user_number: string;
}

export interface BlogTokenResponse {
  access_token: string;
  token_type: string;
  user: BlogAuthUser;
}

/** @deprecated OTP models kept for transitional imports */
export interface OtpRequestPayload {
  display_name: string;
  phone_number: string;
  recaptcha_token: string;
}

export interface OtpRequestResponse {
  message: string;
  expires_in_seconds: number;
  session_info: string;
  debug_otp?: string | null;
}

export interface OtpVerifyPayload {
  phone_number: string;
  otp: string;
  session_info: string;
}

export interface AuthUser {
  id: string;
  email?: string | null;
  phone_number: string | null;
  display_name: string;
  user_number?: string;
}
