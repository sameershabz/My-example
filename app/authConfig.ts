// lib/config.ts
export const config = {
  auth: {
    authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_dlb9dc7ko",
    hostedDomain: process.env.NEXT_PUBLIC_COGNITO_HOSTED_DOMAIN || "",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
    redirectUri: "http://localhost:3000/auth/callback",
    logoutUri: process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI || "",
    // userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
  },
  api: {
    saveRefreshToken: process.env.NEXT_PUBLIC_API_SAVE_REFRESH_TOKEN || "",
  },
}

export function getLogoutUrl() {
  if (!config.auth.hostedDomain || !config.auth.clientId) {
    console.error("Missing Cognito configuration")
    return "/signin"
  }
  return `${config.auth.hostedDomain}/logout?client_id=${config.auth.clientId}&logout_uri=${encodeURIComponent(config.auth.logoutUri)}`
}

export function validateConfig() {
  const required = [
    'NEXT_PUBLIC_COGNITO_AUTHORITY',
    'NEXT_PUBLIC_COGNITO_HOSTED_DOMAIN',
    'NEXT_PUBLIC_COGNITO_CLIENT_ID',
    'NEXT_PUBLIC_COGNITO_REDIRECT_URI',
    'NEXT_PUBLIC_COGNITO_LOGOUT_URI',
    'NEXT_PUBLIC_API_SAVE_REFRESH_TOKEN',
  ]
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error("Missing required environment variables:", missing.join(", "))
    return false
  }
  return true
}
