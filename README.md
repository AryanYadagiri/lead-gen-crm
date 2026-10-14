# Lead Gen CRM

A combined workspace for the Lead Generation CRM system.

## Project Structure

- `lead-generation/` — Backend (Java, Spring Boot, Maven, PostgreSQL on port 8080)
- `lead-automation/` — Frontend (Next.js, React, Tailwind CSS on port 3000)

---

## Quick Start (Run Both Simultaneously)

From the root directory:

```bash
npm run dev
```

Alternatively:
- **Windows Batch**: Double-click or run `start-dev.bat`
- **PowerShell**: Run `.\start-dev.ps1`

Both services will start concurrently in a single terminal with color-coded prefixes:
- `[BACKEND]` → Spring Boot (`http://localhost:8080`)
- `[FRONTEND]` → Next.js (`http://localhost:3000`)

Press `Ctrl + C` in the terminal to stop both services simultaneously.

---

## Run Services Individually

### Backend only:
```bash
npm run dev:backend
# or:
cd lead-generation && .\mvnw.cmd spring-boot:run
```

### Frontend only:
```bash
npm run dev:frontend
# or:
cd lead-automation && npm run dev
```
