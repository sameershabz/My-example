// Centralized configuration for URLs and environment settings
export const config = {
  // Base URLs
  baseUrl: "https://telematicshub.vercel.app",

  // Authentication URLs
  auth: {
    redirectUri: "https://telematicshub.vercel.app",
    logoutUri: "https://v0-my-site-tau.vercel.app/logout-callback",
    cognitoDomain: "https://us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com",
    clientId: "79ufsa70isosab15kpcmlm628d",
  },

  // API endpoints
  api: {
    query: "/api/query",
    command: "/api/command",
    gnssTime: "/api/GNSSTime",
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
