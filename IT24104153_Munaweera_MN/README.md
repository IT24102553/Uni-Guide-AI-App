# IT24104153_Munaweera_MN

This folder contains an isolated version of the **student chat** part from the UniGuide AI project.

## Included scope
- Frontend: student login and student chat conversation flow only
- Backend: login, chat conversations, chat history, message rating, image upload, and demo student seed account
- Original project folders outside this directory were not changed

## Demo account
- Email: `it24104153@my.sliit.lk`
- Password: `Student@123`

## Run backend
```bash
cd Backend
cp .env.example .env
npm install
npm start
```

## Run frontend
```bash
cd Frontend
cp .env.example .env
npm install
npm start
```

## Notes
- The backend seeds the demo student account automatically on first start.
- The frontend defaults to `http://localhost:5000` if `EXPO_PUBLIC_API_URL` is not set.
- If you test on a physical phone, replace `localhost` in `Frontend/.env` with your computer IP address.
