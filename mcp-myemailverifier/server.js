#!/usr/bin/env node
/**
 * MyEmailVerifier MCP Server
 * Exposes API documentation, real-time email verification, and credit checking
 * for MyEmailVerifier (https://myemailverifier.com)
 */

const readline = require('readline');
const https = require('https');

const DEFAULT_API_KEY = process.env.MYEMAILVERIFIER_API_KEY || '';

const API_DOCS = `# MyEmailVerifier API Documentation

## Overview
MyEmailVerifier provides real-time email verification to validate deliverability, catch-all domains, disposable domains, role accounts, and spam traps.

## Endpoints

### 1. Fast Single Email Validation (Recommended)
- **URL**: \`https://api.myemailverifier.com/api/validate_single.php\`
- **Method**: GET
- **Parameters**:
  - \`apikey\`: Your API Key
  - \`email\`: The email address to verify
- **Response Format**: JSON
\`\`\`json
{
  "Address": "test@example.com",
  "catch_all": 0,
  "Disposable_Domain": 0,
  "Role_Based": 0,
  "Free_Domain": 0,
  "Greylisted": 0,
  "Status": "Valid",
  "Diagnosis": "Mailbox exists and active. Safe to send (D2)"
}
\`\`\`

### 2. Comprehensive Validation Endpoint
- **URL**: \`https://client.myemailverifier.com/verifier/validate_single/{email}/{apikey}\`
- **Method**: GET

### 3. Credit Balance Check
- **URL**: \`https://client.myemailverifier.com/verifier/getcredits/{apikey}\`
- **Method**: GET
- **Response**: \`{"status": true, "credits": 99}\`

### 4. Bulk Verification
- **Upload File**: \`POST https://client.myemailverifier.com/verifier/upload_file\` (multipart/form-data: filename, api_key)
- **File Status**: \`GET https://client.myemailverifier.com/verifier/file_info/{apikey}/{file_id}\`

## Response Field Definitions
- **Status**:
  - \`Valid\`: Confirmed deliverable via SMTP verification. Safe to send.
  - \`Invalid\`: Mailbox does not exist, bad syntax, or rejected domain. DO NOT SEND to prevent sender reputation drops and blacklisting.
  - \`Catch-all\`: Domain server accepts all emails for any prefix. Deliverability is uncertain.
  - \`Unknown\`: Server greylisted, network timeout, or verification inconclusive.
- **Diagnosis Codes**:
  - \`D2\`: Mailbox exists and active. Safe to send.
  - \`D21\`: Mailbox not found on recipient mailserver.
  - \`D36\`: Mailbox does not exist / rejected during SMTP RCPT TO phase.
- **catch_all**: \`1\` / \`"true"\` if receiving domain has catch-all enabled.
- **Disposable_Domain**: \`1\` / \`"true"\` if domain provides burner/temporary emails (e.g., Mailinator, TempMail).
- **Role_Based**: \`1\` / \`"true"\` if address is functional (support@, admin@, billing@, sales@).
- **Free_Domain**: \`1\` / \`"true"\` if domain belongs to public freemail (gmail.com, yahoo.com, outlook.com).
- **Greylisted**: \`1\` / \`"true"\` if mail server temporarily deferred verification.
`;

const TOOLS = [
  {
    name: 'get_documentation',
    description: 'Fetch complete API documentation, endpoints, response schemas, and best practices for MyEmailVerifier.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'verify_email',
    description: 'Verify a single email address deliverability using MyEmailVerifier fast validation API.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'The email address to verify (e.g. user@example.com)'
        },
        apiKey: {
          type: 'string',
          description: 'Optional API Key. Defaults to configured key if not provided.'
        }
      },
      required: ['email']
    }
  },
  {
    name: 'check_credits',
    description: 'Check remaining API credits on MyEmailVerifier account.',
    inputSchema: {
      type: 'object',
      properties: {
        apiKey: {
          type: 'string',
          description: 'Optional API Key. Defaults to configured key if not provided.'
        }
      },
      required: []
    }
  }
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function handleToolCall(name, args) {
  if (name === 'get_documentation') {
    return {
      content: [{ type: 'text', text: API_DOCS }],
      isError: false
    };
  }

  if (name === 'check_credits') {
    const key = args?.apiKey || DEFAULT_API_KEY;
    const url = `https://client.myemailverifier.com/verifier/getcredits/${encodeURIComponent(key)}`;
    try {
      const result = await httpGet(url);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Failed to check credits: ${err.message}` }],
        isError: true
      };
    }
  }

  if (name === 'verify_email') {
    const email = args?.email;
    if (!email) {
      return {
        content: [{ type: 'text', text: 'Error: email argument is required' }],
        isError: true
      };
    }
    const key = args?.apiKey || DEFAULT_API_KEY;
    const url = `https://api.myemailverifier.com/api/validate_single.php?apikey=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`;
    try {
      const result = await httpGet(url);
      const isDeliverable = (typeof result === 'object' && result?.Status === 'Valid');
      const isInvalid = (typeof result === 'object' && result?.Status === 'Invalid');
      const summary = {
        verification: result,
        deliverable: isDeliverable,
        safeToSend: isDeliverable,
        shouldAvoidSending: isInvalid,
        recommendation: isInvalid ? 'DO NOT SEND - invalid mailbox' : (isDeliverable ? 'SAFE TO SEND' : 'PROCEED WITH CAUTION')
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        isError: false
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Failed to verify email: ${err.message}` }],
        isError: true
      };
    }
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true
  };
}

function sendResponse(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request;
  try {
    request = JSON.parse(trimmed);
  } catch (e) {
    console.error('Failed to parse JSON RPC request:', e);
    return;
  }

  const { id, method, params } = request;

  if (method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'myemailverifier-mcp',
          version: '1.0.0'
        }
      }
    });
    return;
  }

  if (method === 'notifications/initialized') {
    // Client notification, no reply needed
    return;
  }

  if (method === 'ping') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {}
    });
    return;
  }

  if (method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS
      }
    });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params || {};
    try {
      const toolResult = await handleToolCall(name, toolArgs);
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: toolResult
      });
    } catch (err) {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `Execution error: ${err.message}` }],
          isError: true
        }
      });
    }
    return;
  }

  if (id !== undefined) {
    sendResponse({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    });
  }
});
