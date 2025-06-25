# 🏥 Operation Scheduler for Hospital Management

A modern hospital operation theatre (OT) scheduler built with **FastAPI**, **React**, and **Firebase**, designed to simplify and streamline surgery scheduling, doctor/patient management, and resource allocation.

---

## 📌 Features

### 🔐 Authentication
- Token-based auth (using Firebase Admin SDK – optional for development)

### 🧑‍⚕️ Doctor Module
- Add, edit, delete doctor details
- View all registered doctors

### 🧑‍🤝‍🧑 Patient Module
- Add, edit, delete patient details
- View medical and emergency info

### 🛠️ Surgery Scheduling
- Book surgeries with OT, doctor, patient, time, anesthesiologist, etc.
- Conflict checker to avoid double bookings
- Emergency surgery support with override

### 📅 Scheduler Dashboard
- See daily & upcoming OT activities
- Filter by date/OT/doctor

### 📁 File Upload
- Upload surgical reports (PDF/images) to Firebase Storage

### 📝 Logs
- Track all actions: surgeries scheduled/updated/cancelled

---

## 🧪 Tech Stack

| Layer      | Stack                           |
|------------|---------------------------------|
| Frontend   | React + TailwindCSS             |
| Backend    | FastAPI + Python                |
| Database   | Firebase Firestore              |
| Storage    | Firebase Storage                |
| Auth       | Firebase Admin SDK              |
| Hosting    | Localhost (or Firebase optional)|
| API Server | Uvicorn                         |

---

## 📁 Folder Structure

```
Operation-Management/
├── backend/            ← FastAPI backend
│   └── server.py       ← Main API file
│   └── serviceAccountKey.json
├── frontend/           ← React frontend
│   └── App.js
│   └── api/
├── README.md
```

---

## 🚀 Getting Started

### 🔧 Backend Setup (FastAPI + Firebase)

1. **Install dependencies**

```bash
python -m pip install fastapi uvicorn firebase-admin python-multipart
```

2. **Add Firebase service account**

Download `serviceAccountKey.json` from Firebase Console and place it inside `/backend/`.

3. **Modify `server.py`**

Replace this line:

```python
firebase_admin.initialize_app()
```

With:

```python
from firebase_admin import credentials
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
```

4. **Start FastAPI Server**

```bash
cd backend
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

---

### 💻 Frontend Setup (React)

1. **Install frontend dependencies**

```bash
cd frontend
npm install
```

2. **Start the React frontend**

```bash
npm start
```

> If port 3000 is busy, use: `npm start -- --port=3001`

3. Visit [`http://localhost:3000`](http://localhost:3000)

---

## 🔐 Firebase Configuration

- **Firestore**: Enabled in test mode
- **Storage**: Used to upload surgical reports
- **Authentication**: Optional (admin SDK used for token validation)

---

## 🛠️ API Overview

| Endpoint                         | Method | Description                          |
|----------------------------------|--------|--------------------------------------|
| `/api/doctors`                  | GET/POST | Manage doctors                    |
| `/api/patients`                 | GET/POST | Manage patients                   |
| `/api/surgeries`                | GET/POST/PUT/DELETE | Full surgery scheduling  |
| `/api/surgeries/check-conflict` | POST    | Check OT conflict before scheduling |
| `/api/logs`                     | GET     | View action logs                    |

---

## ✅ Testing Checklist

- [x] Create doctors & patients
- [x] Schedule surgery with and without conflicts
- [x] Log actions in Firestore
- [x] Handle 403s gracefully in frontend
- [x] Upload and retrieve surgery files

---

## 🧠 Troubleshooting

### 🔒 403 Forbidden from FastAPI
Make sure `get_current_user` does not enforce a token during development:

```python
from fastapi import Request

async def get_current_user(request: Request):
    return {"uid": "test_user", "email": "test@example.com"}
```

### 🔥 Firestore Connection Fails?
Ensure this:
```python
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
```

---


## 📚 License

This project is for educational use under MIT License.

---

## 👨‍💻 Developed By

**Sanjo** – B.Tech Computer Science Engineer  
With love for Java backend, Cloud, and DevOps 💻☁️🚀
