# IT24103756 - Knowledge Base FAQ Management

Standalone frontend and backend for the Uni Guide AI knowledge base FAQ management part. This folder is intentionally isolated from the original project files so the FAQ management part can be run and reviewed by itself.

## Included Project Files

The folder also includes the original project code relevant to the Knowledge Base FAQ Management part:

- `backend/controllers/knowledgeBaseController.js`
- `backend/models/KnowledgeBaseFaq.js`
- `backend/models/KnowledgeBaseDocument.js`
- `backend/models/KnowledgeBaseChunk.js`
- `backend/routes/knowledgeBase.js`
- `backend/services/knowledgeBaseService.js`
- `backend/services/ragService.js`
- `backend/services/geminiService.js`
- `backend/utils/knowledgeBaseUpload.js`
- `backend/utils/knowledgeBaseDocumentStore.js`
- `backend/scripts/seedKnowledgeBaseFaqs.js`
- `frontend/src/api/knowledgeBase.js`
- `frontend/src/components/ReadOnlyKnowledgeBaseFaqScreen.js`
- `frontend/src/screens/admin/KnowledgeBaseScreen.js`
- `frontend/src/screens/staff/StaffKnowledgeBaseScreen.js`

Supporting imports used by those files are included in the same `backend` and `frontend/src` structure.

## Features

- Search FAQs by category, question, answer, status, or tags.
- Add new FAQs with category, answer, tags, and publication status.
- Edit existing FAQs from the FAQ library.
- Delete FAQs with a confirmation step.
- Persist FAQ data in `backend/data/faqs.json`.
- Run backend tests with Node's built-in test runner.

## Run

```bash
cd IT24103756_Jayawardana/backend
npm install
npm start
```

Open `http://localhost:5056` in a browser.

## Test

```bash
cd IT24103756_Jayawardana/backend
npm test
```

## API

- `GET /api/health`
- `GET /api/faqs?search=registration`
- `POST /api/faqs`
- `PUT /api/faqs/:id`
- `DELETE /api/faqs/:id`
