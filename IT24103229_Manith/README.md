# IT24103229_Manith

This folder contains a standalone version of my part of the project:

- Login module
- Query and filter support for analytics records
- Analytics dashboard
- Frontend and backend separated from the original project

The original `Frontend` and `Backend` folders were not changed.

## Demo account

- Email: `admin@my.sliit.lk`
- Password: `Admin@123`

## Run the backend

```bash
cd IT24103229_Manith/backend
npm install
npm start
```

The backend runs on `http://localhost:5050`.

## Run the frontend

Open `IT24103229_Manith/frontend/index.html` in a browser.

If your browser blocks local file access for modules, start a tiny static server instead:

```bash
cd IT24103229_Manith/frontend
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Notes

- This is an isolated submission folder for only my part.
- It includes seeded sample data so the dashboard is visible immediately after login.
- Login attempts are recorded and shown in the dashboard summary.
- Incident records can be created, searched, filtered, edited, and deleted.
