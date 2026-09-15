# Bermuda Cocktail Pub POS & Smart Order System

An offline-first, local-network pub ordering and management system for **Bermuda Cocktail**. Designed specifically for poor cellular/internet environments in pubs & bars.

---

## Key Features

1. **Offline-First Local Network Architecture**:
   - Runs locally on the pub's Wi-Fi router.
   - Customers & staff connect over local Wi-Fi to scan, order, and process payments without needing internet.

2. **Automated Split Order Routing**:
   - **Drink Items** $\rightarrow$ Route instantly to the **Receptionist & Bar Counter Panel** via WebSockets.
   - **Food Items** $\rightarrow$ Route instantly to the **Kitchen Display System (KDS)** & KOT printer.

3. **Table Zone Management**:
   - **Standing Counter Tables** (S-01 to S-05)
   - **4-Member Dining Tables** (D-01 to D-08)
   - **Smoking Zone Tables** (SZ-01 to SZ-04)

4. **Online Cloud Admin Sync**:
   - Periodic background sync pushes local sales data to the Cloud Admin dashboard whenever internet is available.

---

## How to Run

### 1. Backend (FastAPI + SQLite + WebSockets)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend (React + Vite + Tailwind CSS)
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` to access the application. Use the top navigation bar to switch between views:
- **Customer Menu**: Mobile QR ordering view
- **Reception / Bar**: Live drink orders & table billing
- **Kitchen KDS**: Food preparation display for chefs
- **Waiter Staff**: Floor zone overview
- **Cloud Admin**: Master menu & QR code generator
