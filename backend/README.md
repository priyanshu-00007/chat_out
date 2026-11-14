# ChatOut Backend (FastAPI + Supabase PostgreSQL)

Custom REST and native WebSocket backend for **ChatSphere**, using Supabase strictly as a hosted PostgreSQL database via SQLAlchemy and Alembic.

## Setup

1. Create and activate the virtual environment inside `backend/`:
   ```powershell
   cd backend
   .\.venv\Scripts\Activate.ps1
   ```
2. Copy `.env.example` to `.env` and set your 
   - `DATABASE_URL` for Supabase PostgreSQL
   - `JWT_SECRET_KEY`
   - `CORS_ORIGINS` to the exact frontend origin, typically `http://localhost:5173`
3. Start the API server:
   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```
4. View Swagger docs at `http://localhost:8000/docs`.
5. Run tests:
   ```powershell
   pytest
   ```

## API contract

The backend exposes the username/password auth endpoints used by the frontend:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`

The server allows the exact Vite frontend origin and handles CORS preflight responses for the auth flow.
