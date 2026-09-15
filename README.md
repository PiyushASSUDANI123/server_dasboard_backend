# ServerOS - Backend API

The Node.js (Express) backend for the ServerOS desktop management dashboard.

## Features
- **Strict Role-Based Access Control (RBAC)**: Admin (full access) vs Viewer (read-only).
- **Path Traversal Protection**: Secure file access limited to allocated jail directories.
- **Google Drive Style Sharing**: Generate unique public links for secure file/folder sharing.
- **System Management**: APIs for real-time CPU/RAM stats, process management, and Docker.
- **Security**: JWT-based authentication.

## Security Notice (HTTPS)
**CRITICAL**: This server must be run behind a reverse proxy (like Nginx or Caddy) with an SSL/TLS certificate (HTTPS) if exposed to the public internet. Tools like Let's Encrypt provide free SSL certificates. Never transmit credentials over plain HTTP.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
