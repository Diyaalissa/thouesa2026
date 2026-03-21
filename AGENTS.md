# AGENTS.md

## Repository identity
This repository is a production Node.js / Express / MySQL application with a static frontend under /web.
Treat it as a cPanel/Namecheap deployment project, not as an AI Studio scaffold.

## Hard constraints
- Do not redesign the stack
- Do not convert the project to another framework
- Do not remove /web
- Do not delete files unless explicitly justified with evidence
- Preserve the full tree whenever possible
- Keep fixes surgical
- Preserve deployment compatibility with cPanel
- Base all conclusions on actual code and actual execution

## Runtime truth sources
Determine runtime truth from:
- app.js
- src/app.cjs
- package.json
- scripts/doctor.js
- src/utils/initDb.js

## Audit order
1. README.md
2. .env.example
3. src/models/schema.js
4. src/routes/*
5. src/controllers/*
6. src/services/*
7. src/validators/*
8. web/index.html
9. web/client.html
10. web/js/*.js

## Allowed commands
Run only:
- npm install
- npm run doctor
- npm start

## Critical flows
- register
- login
- refresh token
- logout
- upload product image
- create order
- update order status
- ticket reply

## Bug classes to prioritize
- broken frontend/backend contracts
- schema/migration conflicts
- public file exposure
- false health/build/test signals
- duplicate exports
- dead code
- state-machine inconsistencies
- token/session inconsistencies
- telemetry/server-info exposure
- upload/KYC exposure
- doctor/runtime mismatch
- schema/initDb mismatch

## Fix scope
Fix only confirmed critical defects in:
- create order flow
- refresh/logout token flow
- KYC/uploads exposure
- schema.js vs initDb.js mismatch
- public telemetry/server-info routes
- confirmed /web ↔ backend contract mismatches

## Output format
Return only:
1. Confirmed defects
2. What was actually fixed
3. Modified files
4. Unified diffs
5. Runtime results
6. Final verdict:
   - release_ready=true|false
   - pilot_ready=true|false
