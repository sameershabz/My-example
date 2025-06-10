// Get site URL from environment or use default
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-my-site-tau.vercel.app"

// Centralized configuration for URLs and environment settings
export const config = {
  // Base URLs
  baseUrl: SITE_URL,

  // Authentication URLs
  auth: {
    redirectUri: SITE_URL,
    logoutUri: `${SITE_URL}/logout-callback`,
    cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "79ufsa70isosab15kpcmlm628d",
  },

  // API endpoints
  api: {
    query: "/api/query",
    command: "/api/command",
    gnssTime: "/api/gnsstime",
    saveRefreshToken: "/api/save-refresh-token",
    revokeToken: "/api/revoke-token",
  },

  // External services
  external: {
    awsCommandUrl: process.env.AWS_COMMAND_URL,
    awsGnssUrl: process.env.AWS_GNSS_URL,
    awsQueryUrl: process.env.AWS_QUERY_URL,
  },
} as const

// Helper function to get full URL
export const getFullUrl = (path: string) => {
  return `${config.baseUrl}${path}`
}

// Helper function to get auth logout URL
export const getLogoutUrl = () => {
  return `${config.auth.cognitoDomain}/logout?client_id=${config.auth.clientId}&logout_uri=${encodeURIComponent(config.auth.logoutUri)}`
}
