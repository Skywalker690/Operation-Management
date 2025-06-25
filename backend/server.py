from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional
import firebase_admin
from firebase_admin import credentials, firestore, auth, storage
import json
import os
import uuid
from contextlib import asynccontextmanager

# Initialize Firebase Admin
def initialize_firebase():
    if not firebase_admin._apps:
        try:
            # For MVP, we'll use Application Default Credentials
            # In production, you would configure proper service account
            firebase_admin.initialize_app()
            print("Firebase initialized successfully")
        except Exception as e:
            print(f"Firebase initialization error: {e}")
            # For development, we'll continue without Firebase Admin
            # The client-side Firebase will handle authentication
            return None

# Initialize Firebase
initialize_firebase()

# For development, we'll use a simple in-memory store if Firebase fails
# In production, this would always use Firestore
try:
    db = firestore.client()
    print("Firestore client initialized")
except Exception as e:
    print(f"Firestore client error: {e}")
    db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting up...")
    yield
    # Shutdown
    print("Shutting down...")

app = FastAPI(lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# Pydantic models
class Doctor(BaseModel):
    id: Optional[str] = None
    name: str
    specialization: str
    email: str
    phone: str
    department: str

class Patient(BaseModel):
    id: Optional[str] = None
    name: str
    age: int
    gender: str
    medical_record_number: str
    phone: str
    emergency_contact: str

class Surgery(BaseModel):
    id: Optional[str] = None
    patient_id: str
    doctor_id: str
    surgery_date: str
    surgery_time: str
    ot_id: str
    anesthesiologist: str
    anesthesia_type: str
    assistant_surgeon: Optional[str] = None
    nurses: Optional[List[str]] = None
    pre_op_events: Optional[str] = None
    post_op_events: Optional[str] = None
    surgical_report_url: Optional[str] = None
    notes: Optional[str] = None
    required_instruments: Optional[str] = None
    status: str = "scheduled"  # scheduled, in_progress, completed, cancelled
    is_emergency: bool = False
    duration_minutes: int = 120  # default 2 hours

class ConflictCheck(BaseModel):
    surgery_date: str
    surgery_time: str
    ot_id: str
    duration_minutes: int
    exclude_surgery_id: Optional[str] = None

# Auth dependency
async def get_current_user(token: str = Depends(security)):
    try:
        # For development, we'll skip Firebase auth verification
        # In production, you'd verify the token here
        return {"uid": "test_user", "email": "test@example.com"}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication")

# Core scheduling logic with fallback
def check_scheduling_conflict(surgery_data: dict, exclude_id: str = None) -> bool:
    """Check if a surgery conflicts with existing schedules"""
    try:
        if not db:
            # For development without Firestore, we'll return False
            return False
            
        surgery_datetime = datetime.strptime(f"{surgery_data['surgery_date']} {surgery_data['surgery_time']}", "%Y-%m-%d %H:%M")
        surgery_end = surgery_datetime + timedelta(minutes=surgery_data['duration_minutes'])
        
        # Query existing surgeries for the same OT and date
        surgeries_ref = db.collection('surgeries')
        query = surgeries_ref.where('ot_id', '==', surgery_data['ot_id']).where('surgery_date', '==', surgery_data['surgery_date'])
        
        if exclude_id:
            query = query.where('id', '!=', exclude_id)
        
        existing_surgeries = query.stream()
        
        for surgery_doc in existing_surgeries:
            existing_surgery = surgery_doc.to_dict()
            if existing_surgery['status'] == 'cancelled':
                continue
                
            existing_datetime = datetime.strptime(f"{existing_surgery['surgery_date']} {existing_surgery['surgery_time']}", "%Y-%m-%d %H:%M")
            existing_end = existing_datetime + timedelta(minutes=existing_surgery['duration_minutes'])
            
            # Check for overlap
            if (surgery_datetime < existing_end and surgery_end > existing_datetime):
                return True
                
        return False
    except Exception as e:
        print(f"Error checking conflict: {e}")
        return False

# API Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Doctor endpoints
@app.post("/api/doctors")
async def create_doctor(doctor: Doctor, current_user: dict = Depends(get_current_user)):
    try:
        if not db:
            raise HTTPException(status_code=503, detail="Database service unavailable")
            
        doctor_id = str(uuid.uuid4())
        doctor_data = doctor.dict()
        doctor_data['id'] = doctor_id
        doctor_data['created_at'] = datetime.now().isoformat()
        
        db.collection('doctors').document(doctor_id).set(doctor_data)
        return {"id": doctor_id, "message": "Doctor created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/doctors")
async def get_doctors():
    try:
        if not db:
            # Return sample data for development
            return [
                {
                    "id": "sample-doctor-1",
                    "name": "Dr. John Smith",
                    "specialization": "Cardiothoracic Surgery",
                    "email": "john.smith@hospital.com",
                    "phone": "+1-555-0101",
                    "department": "Cardiothoracic",
                    "created_at": "2025-01-02T10:00:00"
                },
                {
                    "id": "sample-doctor-2", 
                    "name": "Dr. Sarah Johnson",
                    "specialization": "Orthopedic Surgery",
                    "email": "sarah.johnson@hospital.com",
                    "phone": "+1-555-0102",
                    "department": "Orthopedics",
                    "created_at": "2025-01-02T10:00:00"
                },
                {
                    "id": "sample-doctor-3",
                    "name": "Dr. Michael Brown",
                    "specialization": "Neurosurgery",
                    "email": "michael.brown@hospital.com", 
                    "phone": "+1-555-0103",
                    "department": "Neurology",
                    "created_at": "2025-01-02T10:00:00"
                }
            ]
            
        doctors_ref = db.collection('doctors')
        doctors = []
        for doc in doctors_ref.stream():
            doctor_data = doc.to_dict()
            doctors.append(doctor_data)
        return doctors
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/doctors/{doctor_id}")
async def get_doctor(doctor_id: str):
    try:
        doc_ref = db.collection('doctors').document(doctor_id)
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        else:
            raise HTTPException(status_code=404, detail="Doctor not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, doctor: Doctor, current_user: dict = Depends(get_current_user)):
    try:
        doctor_data = doctor.dict()
        doctor_data['updated_at'] = datetime.now().isoformat()
        
        db.collection('doctors').document(doctor_id).update(doctor_data)
        return {"message": "Doctor updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db.collection('doctors').document(doctor_id).delete()
        return {"message": "Doctor deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Patient endpoints
@app.post("/api/patients")
async def create_patient(patient: Patient, current_user: dict = Depends(get_current_user)):
    try:
        patient_id = str(uuid.uuid4())
        patient_data = patient.dict()
        patient_data['id'] = patient_id
        patient_data['created_at'] = datetime.now().isoformat()
        
        db.collection('patients').document(patient_id).set(patient_data)
        return {"id": patient_id, "message": "Patient created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/patients")
async def get_patients():
    try:
        if not db:
            # Return sample data for development
            return [
                {
                    "id": "sample-patient-1",
                    "name": "Alice Johnson",
                    "age": 34,
                    "gender": "Female",
                    "medical_record_number": "MRN001234",
                    "phone": "+1-555-0201",
                    "emergency_contact": "+1-555-0301",
                    "created_at": "2025-01-02T10:00:00"
                },
                {
                    "id": "sample-patient-2",
                    "name": "Bob Williams",
                    "age": 58,
                    "gender": "Male", 
                    "medical_record_number": "MRN001235",
                    "phone": "+1-555-0202",
                    "emergency_contact": "+1-555-0302",
                    "created_at": "2025-01-02T10:00:00"
                },
                {
                    "id": "sample-patient-3",
                    "name": "Carol Davis",
                    "age": 42,
                    "gender": "Female",
                    "medical_record_number": "MRN001236", 
                    "phone": "+1-555-0203",
                    "emergency_contact": "+1-555-0303",
                    "created_at": "2025-01-02T10:00:00"
                }
            ]
            
        patients_ref = db.collection('patients')
        patients = []
        for doc in patients_ref.stream():
            patient_data = doc.to_dict()
            patients.append(patient_data)
        return patients
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/patients/{patient_id}")
async def get_patient(patient_id: str):
    try:
        doc_ref = db.collection('patients').document(patient_id)
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        else:
            raise HTTPException(status_code=404, detail="Patient not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/patients/{patient_id}")
async def update_patient(patient_id: str, patient: Patient, current_user: dict = Depends(get_current_user)):
    try:
        patient_data = patient.dict()
        patient_data['updated_at'] = datetime.now().isoformat()
        
        db.collection('patients').document(patient_id).update(patient_data)
        return {"message": "Patient updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/patients/{patient_id}")
async def delete_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    try:
        db.collection('patients').document(patient_id).delete()
        return {"message": "Patient deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Surgery scheduling endpoints
@app.post("/api/surgeries")
async def create_surgery(surgery: Surgery, current_user: dict = Depends(get_current_user)):
    try:
        surgery_id = str(uuid.uuid4())
        surgery_data = surgery.dict()
        surgery_data['id'] = surgery_id
        surgery_data['created_at'] = datetime.now().isoformat()
        
        # Check for conflicts
        if check_scheduling_conflict(surgery_data):
            raise HTTPException(status_code=409, detail="Surgery time conflicts with existing schedule")
        
        db.collection('surgeries').document(surgery_id).set(surgery_data)
        
        # Log the action
        log_data = {
            "action": "surgery_created",
            "surgery_id": surgery_id,
            "user_id": current_user.get("uid", "unknown"),
            "timestamp": datetime.now().isoformat(),
            "details": f"Surgery scheduled for {surgery_data['surgery_date']} at {surgery_data['surgery_time']}"
        }
        db.collection('logs').add(log_data)
        
        return {"id": surgery_id, "message": "Surgery scheduled successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/surgeries/check-conflict")
async def check_conflict(conflict_check: ConflictCheck):
    try:
        surgery_data = {
            "surgery_date": conflict_check.surgery_date,
            "surgery_time": conflict_check.surgery_time,
            "ot_id": conflict_check.ot_id,
            "duration_minutes": conflict_check.duration_minutes
        }
        
        has_conflict = check_scheduling_conflict(surgery_data, conflict_check.exclude_surgery_id)
        return {"has_conflict": has_conflict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/surgeries")
async def get_surgeries(date: Optional[str] = None, ot_id: Optional[str] = None):
    try:
        if not db:
            # Return sample data for development
            today = datetime.now().date().isoformat()
            return [
                {
                    "id": "sample-surgery-1",
                    "patient_id": "sample-patient-1",
                    "doctor_id": "sample-doctor-1",
                    "surgery_date": today,
                    "surgery_time": "09:00",
                    "ot_id": "1",
                    "anesthesiologist": "Dr. Smith",
                    "anesthesia_type": "General",
                    "assistant_surgeon": "",
                    "nurses": ["Nurse Adams", "Nurse Brown"],
                    "pre_op_events": "",
                    "post_op_events": "",
                    "surgical_report_url": "",
                    "notes": "Routine cardiac procedure",
                    "required_instruments": "Cardiac surgery set",
                    "status": "scheduled",
                    "is_emergency": False,
                    "duration_minutes": 180,
                    "created_at": "2025-01-02T08:00:00"
                },
                {
                    "id": "sample-surgery-2",
                    "patient_id": "sample-patient-2", 
                    "doctor_id": "sample-doctor-2",
                    "surgery_date": today,
                    "surgery_time": "14:00",
                    "ot_id": "2",
                    "anesthesiologist": "Dr. Wilson",
                    "anesthesia_type": "Spinal",
                    "assistant_surgeon": "",
                    "nurses": ["Nurse Clark"],
                    "pre_op_events": "",
                    "post_op_events": "",
                    "surgical_report_url": "",
                    "notes": "Knee replacement surgery",
                    "required_instruments": "Orthopedic set",
                    "status": "scheduled",
                    "is_emergency": False,
                    "duration_minutes": 120,
                    "created_at": "2025-01-02T08:00:00"
                }
            ]
            
        surgeries_ref = db.collection('surgeries')
        
        if date:
            surgeries_ref = surgeries_ref.where('surgery_date', '==', date)
        if ot_id:
            surgeries_ref = surgeries_ref.where('ot_id', '==', ot_id)
            
        surgeries = []
        for doc in surgeries_ref.stream():
            surgery_data = doc.to_dict()
            surgeries.append(surgery_data)
            
        # Sort by date and time
        surgeries.sort(key=lambda x: f"{x['surgery_date']} {x['surgery_time']}")
        return surgeries
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/surgeries/{surgery_id}")
async def get_surgery(surgery_id: str):
    try:
        doc_ref = db.collection('surgeries').document(surgery_id)
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        else:
            raise HTTPException(status_code=404, detail="Surgery not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/surgeries/{surgery_id}")
async def update_surgery(surgery_id: str, surgery: Surgery, current_user: dict = Depends(get_current_user)):
    try:
        surgery_data = surgery.dict()
        surgery_data['updated_at'] = datetime.now().isoformat()
        
        # Check for conflicts (excluding current surgery)
        if check_scheduling_conflict(surgery_data, surgery_id):
            raise HTTPException(status_code=409, detail="Surgery time conflicts with existing schedule")
        
        db.collection('surgeries').document(surgery_id).update(surgery_data)
        
        # Log the action
        log_data = {
            "action": "surgery_updated",
            "surgery_id": surgery_id,
            "user_id": current_user.get("uid", "unknown"),
            "timestamp": datetime.now().isoformat(),
            "details": f"Surgery updated for {surgery_data['surgery_date']} at {surgery_data['surgery_time']}"
        }
        db.collection('logs').add(log_data)
        
        return {"message": "Surgery updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/surgeries/{surgery_id}")
async def delete_surgery(surgery_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # Instead of deleting, mark as cancelled
        db.collection('surgeries').document(surgery_id).update({
            "status": "cancelled",
            "cancelled_at": datetime.now().isoformat()
        })
        
        # Log the action
        log_data = {
            "action": "surgery_cancelled",
            "surgery_id": surgery_id,
            "user_id": current_user.get("uid", "unknown"),
            "timestamp": datetime.now().isoformat()
        }
        db.collection('logs').add(log_data)
        
        return {"message": "Surgery cancelled successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Emergency surgery handling
@app.post("/api/surgeries/emergency")
async def schedule_emergency_surgery(surgery: Surgery, current_user: dict = Depends(get_current_user)):
    try:
        surgery_id = str(uuid.uuid4())
        surgery_data = surgery.dict()
        surgery_data['id'] = surgery_id
        surgery_data['is_emergency'] = True
        surgery_data['created_at'] = datetime.now().isoformat()
        
        # For emergency surgeries, we still check conflicts but with priority handling
        if check_scheduling_conflict(surgery_data):
            # Emergency surgery takes priority - we'll flag this for manual resolution
            surgery_data['needs_manual_resolution'] = True
        
        db.collection('surgeries').document(surgery_id).set(surgery_data)
        
        # Log the emergency action
        log_data = {
            "action": "emergency_surgery_scheduled",
            "surgery_id": surgery_id,
            "user_id": current_user.get("uid", "unknown"),
            "timestamp": datetime.now().isoformat(),
            "details": f"Emergency surgery scheduled for {surgery_data['surgery_date']} at {surgery_data['surgery_time']}"
        }
        db.collection('logs').add(log_data)
        
        return {"id": surgery_id, "message": "Emergency surgery scheduled", "needs_manual_resolution": surgery_data.get('needs_manual_resolution', False)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get available time slots for a specific date and OT
@app.get("/api/ots/{ot_id}/available-slots")
async def get_available_slots(ot_id: str, date: str):
    try:
        # Get all surgeries for the OT on the given date
        surgeries_ref = db.collection('surgeries')
        surgeries = surgeries_ref.where('ot_id', '==', ot_id).where('surgery_date', '==', date).stream()
        
        booked_slots = []
        for surgery_doc in surgeries:
            surgery_data = surgery_doc.to_dict()
            if surgery_data['status'] != 'cancelled':
                start_time = datetime.strptime(surgery_data['surgery_time'], "%H:%M")
                end_time = start_time + timedelta(minutes=surgery_data['duration_minutes'])
                booked_slots.append({
                    "start": start_time.strftime("%H:%M"),
                    "end": end_time.strftime("%H:%M"),
                    "surgery_id": surgery_data['id']
                })
        
        # Calculate available slots (assuming OT operates 8 AM to 8 PM)
        available_slots = []
        current_time = datetime.strptime("08:00", "%H:%M")
        end_of_day = datetime.strptime("20:00", "%H:%M")
        
        while current_time < end_of_day:
            slot_end = current_time + timedelta(hours=2)  # 2-hour slots
            
            # Check if this slot conflicts with any booked slot
            is_available = True
            for booked in booked_slots:
                booked_start = datetime.strptime(booked['start'], "%H:%M")
                booked_end = datetime.strptime(booked['end'], "%H:%M")
                
                if (current_time < booked_end and slot_end > booked_start):
                    is_available = False
                    break
            
            if is_available:
                available_slots.append({
                    "start": current_time.strftime("%H:%M"),
                    "end": slot_end.strftime("%H:%M")
                })
            
            current_time += timedelta(hours=1)  # Move to next hour
        
        return {"available_slots": available_slots, "booked_slots": booked_slots}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Logs endpoint
@app.get("/api/logs")
async def get_logs(limit: int = 50):
    try:
        logs_ref = db.collection('logs').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limit)
        logs = []
        for doc in logs_ref.stream():
            log_data = doc.to_dict()
            logs.append(log_data)
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)