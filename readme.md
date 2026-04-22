
## Prerequisites

- Python 3.11+
- Node.js 18+
- MySQL 8+
- Tesseract OCR installed and added to PATH

Verify Tesseract:
```bash
tesseract --version
```

On Windows, the Tesseract executable is usually here:
```text
C:\Program Files\Tesseract-OCR\tesseract.exe
```

## Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install django djangorestframework mysqlclient django-cors-headers pillow pytesseract pymupdf
```

If you use a `.env` file, create .env with:

```env
DB_NAME=docdb
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_HOST=localhost
DB_PORT=3306
OCR_TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

Create the database in MySQL:

```bash
mysql -u root -p
```

Run migrations and start the backend:

```bash
python manage.py migrate
python manage.py runserver
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Optional Frontend Environment

If the frontend API base URL is moved to environment variables, create `frontend/.env` with:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## Useful Commands

Backend:

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

Frontend:

```bash
npm install
npm run dev
npm run build
```

## Notes

- Keep .env and `frontend/.env` out of git.
- If Tesseract is installed but OCR does not work, confirm the executable path is correct and available in PATH.
- If MySQL connection fails, check the database name, username, password, host, and port in the environment variables.
```
