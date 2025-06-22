# Telematics Hub Setup Guide

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Site Configuration
NEXT_PUBLIC_SITE_URL=https://fleetdash.vercel.app
NEXT_PUBLIC_BASE_URL=https://fleetdash.vercel.app

# AWS Cognito Configuration - using exact values from working example
NEXT_PUBLIC_COGNITO_AUTHORITY=https://cognito-idp.us-east-1.amazonaws.com/us-east-1_dlB9DC7Ko
NEXT_PUBLIC_COGNITO_CLIENT_ID=79ufsa70isosab15kpcmlm628d
NEXT_PUBLIC_COGNITO_DOMAIN=https://us-east-1dlb9dc7ko.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_COGNITO_REDIRECT_URI=https://fleetdash.vercel.app/auth/callback

# AWS API Endpoints (you'll need to update these with your actual endpoints)
AWS_COMMAND_URL=https://your-api-gateway-url/command
AWS_GNSS_URL=https://your-api-gateway-url/gnss
AWS_QUERY_URL=https://your-api-gateway-url/query
AWS_RAW_DATA_URL=https://your-api-gateway-url/raw-data
```

## Key Improvements Made

### 1. Fixed Logout Functionality
- Proper Cognito session clearing
- Complete local storage cleanup
- Cookie removal
- Prevents users from getting back in after logout

### 2. Raw Data Flow
- New `/api/raw-data` endpoint for fetching raw data from AWS Timestream
- Data processing utility (`lib/data-processor.ts`) for downsampling
- Chart component now accepts both raw and downsampled data
- CSV download functionality for raw data

### 3. Premium Design System
- Modern gradient backgrounds
- Improved typography with Inter font
- Enhanced shadows and animations
- Professional color scheme
- Responsive design improvements

### 4. Simplified Authentication
- Removed complex validation and region checks
- Using exact values from working example
- Simplified auth config structure
- Removed sidebar navigation

### 5. Data Processing
- Raw data fetched from AWS
- Client-side downsampling for charts
- Configurable downsampling options
- CSV export functionality

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## AWS Backend Requirements

The AWS backend should provide these endpoints:

1. **Raw Data Endpoint** (`AWS_RAW_DATA_URL`)
   - Accepts: `start`, `end`, `deviceId` (optional)
   - Returns: Raw JSON data from Timestream

2. **Command Endpoint** (`AWS_COMMAND_URL`)
   - Accepts: Command and parameters
   - Returns: Command execution status

3. **GNSS Endpoint** (`AWS_GNSS_URL`)
   - Returns: Latest device locations

4. **Query Endpoint** (`AWS_QUERY_URL`)
   - Accepts: `start`, `end`, `points`
   - Returns: Downsampled data (legacy)

## Features

- **Real-time Analytics**: Interactive charts with configurable time ranges
- **Fleet Map**: Real-time vehicle tracking with Leaflet
- **Device Commands**: Send commands to fleet devices
- **CSV Export**: Download raw data for analysis
- **Responsive Design**: Works on desktop and mobile
- **Dark Mode**: Automatic theme switching
- **Premium UI**: Modern, professional design
- **Simplified Navigation**: Tabbed interface with logout button at top

## File Structure

```
app/
├── api/                    # API routes
│   ├── raw-data/          # Raw data endpoint
│   ├── query/             # Downsampled data endpoint
│   ├── command/           # Command endpoint
│   └── gnsstime/          # GNSS endpoint
├── components/            # React components
│   ├── DataChart1.tsx     # Chart component
│   ├── VehicleMap.tsx     # Map component
├── lib/
│   ├── config.ts          # Configuration
│   └── data-processor.ts  # Data processing utilities
└── page.tsx               # Main dashboard
```

## Authentication Flow

The authentication now uses the exact same configuration as your working example:

- **Authority**: `https://cognito-idp.us-east-1.amazonaws.com/us-east-1_dlB9DC7Ko`
- **Client ID**: `79ufsa70isosab15kpcmlm628d`
- **Scope**: `email openid phone`
- **Response Type**: `code`

This matches your working React example exactly, ensuring compatibility. 