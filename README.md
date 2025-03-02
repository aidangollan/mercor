# LinkedIn Network Visualization

A comprehensive web application and Chrome extension for visualizing and analyzing your LinkedIn network. This project allows you to upload your LinkedIn connections, analyze their relationships, and visualize the network using a graph-based interface.

## Features

- **LinkedIn Connection Upload**: Upload your LinkedIn connections using the Chrome extension
- **Graph Visualization**: Interactive visualization of your professional network
- **Network Analysis**: PageRank algorithm to identify influential connections
- **Clout Scoring**: AI-powered analysis of profile strength and network influence
- **Node Merging**: Intelligent merging of duplicate profiles based on LinkedIn usernames

## System Architecture

The system consists of two main components:

1. **Web Application**: A Next.js application that provides the user interface and backend API
2. **Chrome Extension**: A browser extension that extracts LinkedIn connections

### How They Interact

1. The Chrome extension adds an "Upload Connections" button to your LinkedIn connections page
2. When clicked, it extracts connection data and sends it to the web application's API
3. The web application processes the connections, creates a graph database, and visualizes the network

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- Chrome browser (for the extension)
- Neo4j database (v5.0 or higher)

## Setup Instructions

### Web Application Setup

1. Navigate to the webapp directory:
   ```
   cd webapp
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the webapp directory with the following variables:
   ```
   # Database
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your_password

   # API Keys
   PROXYCURL_API_KEY=your_proxycurl_api_key
   OPENAI_KEY=your_openai_api_key
   ```

4. Start the Neo4j database:
   ```
   # On Windows, start your Neo4j instance using the Neo4j Desktop application
   # OR use the provided script
   ./start-database.sh
   ```

5. Run the development server:
   ```
   npm run dev
   ```

6. The web application will be available at http://localhost:3000

### Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" by toggling the switch in the top-right corner

3. Click "Load unpacked" and select the `chrome-extension` directory from this project

4. The extension is now installed and will be active when you visit your LinkedIn connections page at https://www.linkedin.com/mynetwork/invite-connect/connections

## Usage

### Method 1: Using the Chrome Extension

1. Navigate to the LinkedIn page in the web app (http://localhost:3000/linkedin)

2. Click "Go to LinkedIn Connections" which will redirect you to LinkedIn

3. Log in to LinkedIn if prompted

4. On your connections page, click the "Upload Connections" button added by the extension

5. The extension will scroll through your connections to load them all (you can click "Finish Scrolling" to stop early)

6. Enter your LinkedIn username when prompted

7. Your connections will be uploaded to the web application

8. Return to the web application to view your network graph at http://localhost:3000/graph

### Method 2: Direct LinkedIn Integration (Alternative)

The web application also includes a direct LinkedIn integration that doesn't require the Chrome extension:

1. Navigate to the LinkedIn page in the web app

2. Enter your LinkedIn credentials

3. The application will retrieve your connections automatically

4. View your network graph at http://localhost:3000/graph

## Analyzing Your Network

1. The Graph page displays your network with nodes representing people and edges representing connections

2. Nodes are color-coded based on their clout score or PageRank:
   - Green: High influence
   - Yellow: Medium influence
   - Orange: Lower influence

3. Node size also reflects influence - larger nodes are more influential

4. Hover over nodes to see details about each connection

5. Use the controls to zoom, pan, and reset the view

## Development

### Project Structure

- `/webapp`: Next.js web application
  - `/src/app`: Application code
  - `/src/app/api`: API endpoints
  - `/src/app/graph`: Graph visualization page
  - `/src/app/linkedin`: LinkedIn integration page

- `/chrome-extension`: Chrome extension files
  - `manifest.json`: Extension configuration
  - `content.js`: Content script that runs on LinkedIn

### Key Components

- **API Endpoints**:
  - `/api/connections`: Receives connection data from the Chrome extension
  - `/api/graph`: Provides graph data for visualization
  - `/api/process-connections`: Processes uploaded connections
  - `/api/baseclout`: Analyzes LinkedIn profiles for clout scoring

- **Graph Visualization**: Uses react-graph-vis to render the network

- **Chrome Extension**: Injects a button into LinkedIn's connection page and extracts connection data

## Troubleshooting

- **Chrome Extension Not Working**: Make sure you're on the correct LinkedIn connections page and have developer mode enabled in Chrome extensions
- **Connection Upload Failing**: Check that your web application is running on http://localhost:3000
- **Empty Graph**: Ensure that connections were successfully uploaded and processed
- **Database Connection Issues**: Verify your Neo4j credentials and that the database is running

## License

[MIT License](LICENSE)