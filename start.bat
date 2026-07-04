@echo off
echo Starting LegalReach...

if not exist backend\node_modules (
  echo Installing backend dependencies...
  cd backend && npm install && cd ..
)

echo Checking Playwright browser...
cd backend && npx playwright install chromium 2>nul && cd ..

if not exist frontend\node_modules (
  echo Installing frontend dependencies...
  cd frontend && npm install && cd ..
)

if not exist backend\data mkdir backend\data
if not exist backend\logs mkdir backend\logs
if not exist backend\output mkdir backend\output

if not exist .env (
  echo Copying .env.example to .env...
  copy .env.example .env
  echo.
  echo NOTE: Add your GEMINI_API_KEY to .env for full extraction.
  echo       Open Settings in the dashboard after first launch.
)

echo.
echo Starting backend on http://localhost:3001
start "LegalReach Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting frontend on http://localhost:3000
start "LegalReach Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo LegalReach is starting. Open http://localhost:3000 in your browser.
pause