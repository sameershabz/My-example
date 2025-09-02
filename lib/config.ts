// Get site URL from environment or use default
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

// Centralized configuration for URLs and environment settings. 
export const config = {
  // Base URLs
  baseUrl: SITE_URL,

  // Authentication URLs - simplified to match working example
  auth: {
    authority: process.env.NEXT_PUBLIC_COGNITO_AUTHORITY || "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_dlB9DC7Ko",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "79ufsa70isosab15kpcmlm628d",
    redirectUri: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI || `${SITE_URL}/auth/callback`,
    logoutUri: `${SITE_URL}/logout-callback`,
    cognitoDomain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "https://us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com",
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
  // Query behavior
  query: {
    // Optional UTC offset (hours) to shift start/end before sending to backend.
    // Default 0. Set NEXT_PUBLIC_QUERY_UTC_OFFSET_HOURS=8 to shift window back 8h.
    utcOffsetHours: Number(process.env.NEXT_PUBLIC_QUERY_UTC_OFFSET_HOURS || "0"),
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

// Helper function to get auth logout URL - simplified
export const getLogoutUrl = () => {
  const clientId = config.auth.clientId
  const logoutUri = config.auth.logoutUri
  const cognitoDomain = config.auth.cognitoDomain
  return `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`
}

// Validate required environment variables
export const validateConfig = () => {
  const required = [
    'NEXT_PUBLIC_COGNITO_AUTHORITY',
    'NEXT_PUBLIC_COGNITO_HOSTED_DOMAIN',
    'NEXT_PUBLIC_COGNITO_CLIENT_ID',
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
