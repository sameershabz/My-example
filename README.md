# Telematics Hub

A Next.js application for vehicle telematics data visualization and management.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn or pnpm

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Copy the environment variables:
   \`\`\`bash
   cp .env.example .env.local
   \`\`\`

4. Fill in your environment variables in `.env.local`

5. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

### Environment Variables

Required environment variables (see `.env.example`):

- `AWS_GNSS_URL` - AWS GNSS service endpoint
- `AWS_COMMAND_URL` - AWS command service endpoint  
- `AWS_QUERY_URL` - AWS query service endpoint
- `COGNITO_CLIENT_ID` - AWS Cognito client ID
- `COGNITO_DOMAIN` - AWS Cognito domain

### Deployment

This application is configured for deployment on Vercel. Make sure to set all environment variables in your Vercel project settings.

### API Routes

- `/api/gnsstime` - GNSS time data
- `/api/command` - Send commands to devices
- `/api/query` - Query device data
- `/api/save-refresh-token` - Save authentication tokens
- `/api/revoke-token` - Revoke authentication tokens

### Features

- Vehicle location tracking and mapping
- Real-time telematics data visualization
- Command sending to connected devices
- Analytics dashboard
- Authentication via AWS Cognito
\`\`\`

Now let me create a proper next.config.mjs file:
