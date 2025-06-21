// Get site URL from environment or use default
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

// Centralized configuration for URLs and environment settings
export const config = {
  // Base URLs
  baseUrl: SITE_URL,

  // Authentication URLs
  auth: {
    redirectUri: `${SITE_URL}/auth/callback`,
    logoutUri: `${SITE_URL}/logout-callback`,
    cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
  },

  // API endpoints
  api: {
    query: "/api/query",
    command: "/api/command",
    gnssTime: "/api/gnsstime",
    saveRefreshToken: "/api/save-refresh-token",
    revokeToken: "/api/revoke-token",
    rawData: "/api/raw-data",
  },

  // External services
  external: {
    awsCommandUrl: process.env.AWS_COMMAND_URL,
    awsGnssUrl: process.env.AWS_GNSS_URL,
    awsQueryUrl: process.env.AWS_QUERY_URL,
    awsRawDataUrl: process.env.AWS_RAW_DATA_URL,
  },
} as const

// Helper function to get full URL
export const getFullUrl = (path: string) => {
  return `${config.baseUrl}${path}`
}

// Helper function to get auth logout URL
export const getLogoutUrl = () => {
  if (!config.auth.cognitoDomain || !config.auth.clientId) {
    console.error("Missing Cognito configuration")
    return "/signin"
  }
  return `${config.auth.cognitoDomain}/logout?client_id=${config.auth.clientId}&logout_uri=${encodeURIComponent(config.auth.logoutUri)}`
}

// Validate required environment variables
export const validateConfig = () => {
  const required = [
    'NEXT_PUBLIC_COGNITO_DOMAIN',
    'NEXT_PUBLIC_COGNITO_CLIENT_ID',
    'NEXT_PUBLIC_COGNITO_USER_POOL_ID',
    'AWS_COMMAND_URL',
    'AWS_GNSS_URL',
    'AWS_QUERY_URL',
    'AWS_RAW_DATA_URL'
  ]
  
  const missing = required.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.warn('Missing environment variables:', missing)
  }
  
  return missing.length === 0
}
