# Campus Customs: Homework 4 (AI Foundations for Managers)

A customer website for Campus Customs, a Yale apparel shop at 57 Broadway, New Haven, with an AI shopping assistant. Customers can browse and filter products, create an account, save favorites, and use a cart. They can also ask the chatbot about prices, sizes, and stock. The chatbot answers from the store database, fills the page with matching products, suggests in-stock alternatives, and can add items to the cart.

| Part | Stack |
|---|---|
| Frontend (`frontend/`) | React 19, Vite 8, TypeScript 7, react-router-dom |
| Backend (`backend/`) | FastAPI, SQLite, PydanticAI 2.51 agent using `gpt-6-luna` through Portkey |

## Documents

| File | What it is |
|---|---|
| [`output/harness.md`](output/harness.md) | Technical harness: database, authentication, agent, tools, model fields, safety rules, audit trail, specifications |
| [`output/usability.md`](output/usability.md) | Usability improvements (Problem 9) |
| [`output/design.md`](output/design.md) | Design updates (Problem 10) |
| [`output/app_check.html`](output/app_check.html) | Site testing report with screenshots (Problem 11); download and double-click to open |
| [`output/audit_trail.json`](output/audit_trail.json) | Append-only log of the agent's activity (Problem 12) |
| [`AI_prompts.md`](AI_prompts.md) | Every prompt used to build the project, by problem |

## Running it

Not included in the repo: the real `.env`, the database, and the product photos (see [`data/README.md`](data/README.md)).

1. `copy .env.example .env`, then put your Portkey key in `.env`.
2. Backend (Python 3.14; on Windows, keep the venv outside OneDrive):
   ```
   python -m venv C:\venvs\hw4
   C:\venvs\hw4\Scripts\python.exe -m pip install -r backend\requirements.txt
   run-backend.cmd
   ```
   The API runs at http://127.0.0.1:8000 and reloads automatically.
3. Frontend (Node.js 24), in a second terminal:
   ```
   cd frontend
   npm install
   npm run dev
   ```
   Open **http://localhost:5173**.

Full details are in *Specifications* in [`output/harness.md`](output/harness.md).
