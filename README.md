# Cash OS

Cash OS is a locally hosted, rule-based personal finance management application that helps users effectively allocate their deposits into various "envelopes" (e.g., Emergency, Transport, Investments) automatically using an internal Rule Engine. 

It provides immense practical value over standard budgeting apps by offering **Auto-Allocation Rules**: whenever a user makes a deposit, the system calculates and routes exact percentages or fixed amounts into the specified envelopes, helping users hit multiple financial goals simultaneously without manual math.

## Features & User Interaction
- **Dynamic Multi-Goals:** Create and manage multiple savings goals that interactively update on the main trendline chart.
- **Transactions Log & Audit:** A fully searchable, sortable, and filterable transaction log.
- **Interactive Dashboards:** All data automatically synchronizes across Envelopes, Allocation Breakdowns, Goals, and the master line chart.
- **Live Exchange Rates:** Integrates an external API to display live USD conversion equivalents for transactions and current balances.

## Setup & Local Execution

1. **Clone the repository:**
   ```bash
   git clone https://github.com/d0-n/cash_os.git
   cd Cash_Os
   ```

2. **Set up virtual environment & install dependencies:**
   ```bash
   python -m venv .venv
   source .venv/Scripts/activate  # (or source .venv/bin/activate on Linux/Mac)
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   EXCHANGE_RATE_API_KEY= your API key 
   JWT_SECRET= your JWT_SECRET
   ```

4. **Run the Application:**
   ```bash
   uvicorn app.main:app --reload
   ```
   Access the app in your browser at `http://127.0.0.1:8000`.

## API & Resource Attribution
- **Currency Conversion:** This application fetches live USD to RWF exchange rates using the [ExchangeRate-API](https://www.exchangerate-api.com/).

---

## Server Deployment & Load Balancer Configuration

This application is deployed across a Load Balancer (Lb01) and two standard web servers (Web01, Web02).

**Server IP Map:**
- **LB01 (Load Balancer & Domain Entry):** `3.95.188.37`
- **Web01 (Application Server 1):** `3.84.150.52`
- **Web02 (Application Server 2):** `44.204.148.199`

### Deployment Steps:
1. **Web Servers (Web01 & Web02):**
   - The code is pulled from GitHub onto both `3.84.150.52` and `44.204.148.199`.
   - The application is run using `uvicorn app.main:app --host 0.0.0.0 --port 8000` inside a systemd service to keep it running in the background.
   - The SQLite database handles persistence on each respective server.

2. **Load Balancer (Lb01):**
   - An Nginx server is installed on `3.95.188.37`.
   - The Nginx configuration (`/etc/nginx/nginx.conf`) is set up with an `upstream` block pointing to the two application servers:
     ```nginx
     upstream cashos_backend {
         ip_hash;
         server 3.84.150.52:8000;
         server 44.204.148.199:8000;
     }

     server {
         listen 80;
         server_name www.d0n.tech;

         location / {
             proxy_pass http://cashos_backend;
             proxy_set_header Host $host;
             proxy_set_header X-Real-IP $remote_addr;
         }
     }
     ```
   - The domain registrar DNS records are pointed as follows:
     - `A Record` for `lb-01` -> `3.95.188.37`
     - `A Record` for `web-01` -> `3.84.150.52`
     - `A Record` for `web-02` -> `44.204.148.199`

## Challenges & Architectural Decisions

### Distributed State & The "Ghost Money" Bug
During deployment, I encountered a critical data consistency issue caused by the standard Round Robin load balancing algorithm. Because the application utilizes a local SQLite database for speed and simplicity, each web server (Web01 and Web02) maintained its own isolated "twin" database. 

When a user signed up, their session and user ID (e.g., ID #5) were saved on Web01. However, upon navigating to the dashboard, the standard Round Robin algorithm routed their subsequent request to Web02. Web02's database had no record of that user, resulting in sudden authentication failures or, worse, pulling data for a completely different user who happened to have ID #5 on Web02 (a bug I dubbed "Ghost Money").

**The Solution:**
To resolve this distributed state issue without migrating to a centralized PostgreSQL database, I reconfigured the Load Balancer to use the **`ip_hash`** algorithm instead of standard Round Robin. 

`ip_hash` guarantees that once a user's IP connects to Web01, the load balancer securely locks their session to that specific server for all future requests. This perfectly resolved the split-brain database issue while maintaining the redundancy of a dual-server architecture. *(Note: `ip_hash` was temporarily disabled during the demo video strictly to showcase the successful traffic splitting between servers, before being immediately re-enabled for production stability).*

## Demo Video
- [Demo Video Link] - https://www.youtube.com/watch?v=KvXVmY3SaSs
- [Deployed Website] - `http://cashos.d0n.tech`
