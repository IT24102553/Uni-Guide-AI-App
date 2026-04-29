# IT24102383 Imani - Resolved Ticket Feedback

This folder contains only the ticket feedback part for resolved and closed tickets.

The backend provides endpoints to list resolved tickets, save feedback, delete feedback, and view the feedback dashboard summary.

The frontend is a small browser view for trying the feedback flow without changing the original Uni Guide AI app code.

Backend MVC files included:

- `Backend/models/TicketFeedback.js`
- `Backend/controllers/feedbackController.js`
- `Backend/services/feedbackService.js`
- `Backend/routes/feedbackRoutes.js`

## Run Backend

```bash
cd IT24102383_Imani/Backend
npm install
npm start
```

Backend runs on `http://localhost:5050`.

## Run Frontend

Open `IT24102383_Imani/Frontend/index.html` in a browser after the backend is running.

## Test

```bash
cd IT24102383_Imani/Backend
npm test
```

## Included Feedback Flow

- Students can add or update feedback only for resolved or closed tickets.
- Rating is validated from 1 to 5 stars.
- Comment length is limited to 500 characters.
- Admin-style dashboard totals show average rating, submission count, and rating breakdown.
