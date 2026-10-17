# Monorepo AI Agent Guide: Lead Gen CRM

## 🛠️ MCP Servers Reference
The following MCP servers are configured and available for this workspace:
- **Render MCP**: `https://mcp.render.com/mcp`
  - Used for managing Render services, databases, deploys, and environment variables.
- **Vercel MCP**: `https://mcp.vercel.com`
  - Used for managing Vercel projects, deployments, domains, and environment variables.
- **MyEmailVerifier MCP**: Local Node server (`c:/Users/Planted_Brains/Documents/lead-gen-crm/mcp-myemailverifier/server.js`)
  - Used for validating emails and inspecting credits.

Configured in:
- Workspace: `.agents/mcp_config.json`
- Global: `~/.gemini/config/mcp_config.json`

## 🌐 Full-Stack Architecture & Production Deployment
- **Frontend**: Next.js App Router deployed on **Vercel**:
  - Primary Project: `lead-gen-crm` (`https://lead-gen-crm-five.vercel.app`) - Root Directory: `lead-automation`
  - Connected Project: `lead-automation` (`https://lead-automation-two.vercel.app`) - Root Directory: `lead-automation`
  - Env Var: `NEXT_PUBLIC_API_URL=https://lead-generation-backend-qw2l.onrender.com`
- **Backend**: Spring Boot 4 + GraalVM Native Image deployed on **Render** (`https://lead-generation-backend-qw2l.onrender.com`)
  - Service ID: `srv-db930hcs728c73bjda80`
  - Database: Render Managed PostgreSQL (`lead-generation-db`, ID: `dpg-db9302rrjlhs73e1kn00-a`)
- **Docker Hub Repository**: `aryanyadagiri/lead-generation:latest`
- **Standalone Backend GitHub**: `https://github.com/AryanYadagiri/lead-generation.git`
- **Monorepo GitHub**: `https://github.com/AryanYadagiri/lead-gen-crm.git`
