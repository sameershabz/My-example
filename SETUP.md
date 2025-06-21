# Telematics Hub Setup Guide

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Site Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# AWS Cognito Configuration
NEXT_PUBLIC_COGNITO_DOMAIN=https://your-cognito-domain.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-cognito-client-id
NEXT_PUBLIC_AWS_REGION=us-east-1

# Server-side Cognito Configuration
COGNITO_CLIENT_ID=your-cognito-client-id

# AWS API Endpoints
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

### 4. Environment Variable Management
- Centralized configuration in `lib/config.ts`
- Proper validation of required variables
- No hardcoded values

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
│   └── dashboard-layout.tsx
├── lib/
│   ├── config.ts          # Configuration
│   └── data-processor.ts  # Data processing utilities
└── page.tsx               # Main dashboard
``` 