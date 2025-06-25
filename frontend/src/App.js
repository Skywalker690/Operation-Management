import React, { useState, useEffect } from 'react';
import './App.css';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAx21NGiiyBkQGDWdPm7svR5TOb8PWO3b4",
  authDomain: "operation-scheduler-ead14.firebaseapp.com",
  projectId: "operation-scheduler-ead14",
  storageBucket: "operation-scheduler-ead14.appspot.com",
  messagingSenderId: "394024799966",
  appId: "1:394024799966:web:985596a481d5bf5f7d7c4f",
  measurementId: "G-V3R7C144JS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Get backend URL from environment
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [surgeries, setSurgeries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadDoctors();
      loadPatients();
      loadSurgeries();
    }
  }, [user]);

  // API calls
  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  };

  const loadDoctors = async () => {
    try {
      const data = await apiCall('/api/doctors');
      setDoctors(data);
    } catch (error) {
      console.error('Failed to load doctors:', error);
    }
  };

  const loadPatients = async () => {
    try {
      const data = await apiCall('/api/patients');
      setPatients(data);
    } catch (error) {
      console.error('Failed to load patients:', error);
    }
  };

  const loadSurgeries = async () => {
    try {
      const data = await apiCall('/api/surgeries');
      setSurgeries(data);
    } catch (error) {
      console.error('Failed to load surgeries:', error);
    }
  };

  // Auth functions
  const handleLogin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed: ' + error.message);
    }
  };

  const handleRegister = async (email, password) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // CRUD operations
  const handleSubmitDoctor = async (formData) => {
    try {
      if (editingItem) {
        await apiCall(`/api/doctors/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiCall('/api/doctors', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      loadDoctors();
      setShowForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to save doctor:', error);
      alert('Failed to save doctor');
    }
  };

  const handleSubmitPatient = async (formData) => {
    try {
      if (editingItem) {
        await apiCall(`/api/patients/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiCall('/api/patients', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      loadPatients();
      setShowForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to save patient:', error);
      alert('Failed to save patient');
    }
  };

  const handleSubmitSurgery = async (formData) => {
    try {
      const surgeryData = {
        ...formData,
        duration_minutes: parseInt(formData.duration_minutes) || 120,
        nurses: formData.nurses ? formData.nurses.split(',').map(n => n.trim()) : []
      };

      if (editingItem) {
        await apiCall(`/api/surgeries/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(surgeryData),
        });
      } else {
        await apiCall('/api/surgeries', {
          method: 'POST',
          body: JSON.stringify(surgeryData),
        });
      }
      loadSurgeries();
      setShowForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to save surgery:', error);
      if (error.message.includes('409')) {
        alert('Surgery time conflicts with existing schedule!');
      } else {
        alert('Failed to save surgery');
      }
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    try {
      await apiCall(`/api/${type}/${id}`, { method: 'DELETE' });
      if (type === 'doctors') loadDoctors();
      if (type === 'patients') loadPatients();
      if (type === 'surgeries') loadSurgeries();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete item');
    }
  };

  // Check for conflicts
  const checkConflict = async (surgeryData) => {
    try {
      const response = await apiCall('/api/surgeries/check-conflict', {
        method: 'POST',
        body: JSON.stringify({
          surgery_date: surgeryData.surgery_date,
          surgery_time: surgeryData.surgery_time,
          ot_id: surgeryData.ot_id,
          duration_minutes: parseInt(surgeryData.duration_minutes) || 120,
          exclude_surgery_id: editingItem?.id
        }),
      });
      return response.has_conflict;
    } catch (error) {
      console.error('Failed to check conflict:', error);
      return false;
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!user) {
    return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  // Filter surgeries for today's view
  const todaysSurgeries = surgeries.filter(surgery => 
    surgery.surgery_date === selectedDate && surgery.status !== 'cancelled'
  );

  // Main dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">OR Scheduler</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Welcome, {user.email}</span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm h-screen">
          <nav className="p-4">
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    currentView === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  📊 Dashboard
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('doctors')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    currentView === 'doctors' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  👨‍⚕️ Doctors
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('patients')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    currentView === 'patients' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🏥 Patients
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('surgeries')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    currentView === 'surgeries' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🔧 OR Schedules
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentView('calendar')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    currentView === 'calendar' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  📅 Calendar View
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          {currentView === 'dashboard' && (
            <DashboardView
              todaysSurgeries={todaysSurgeries}
              doctors={doctors}
              patients={patients}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
            />
          )}
          
          {currentView === 'doctors' && (
            <DoctorsView
              doctors={doctors}
              onAdd={() => { setFormType('doctor'); setShowForm(true); setEditingItem(null); }}
              onEdit={(doctor) => { setFormType('doctor'); setShowForm(true); setEditingItem(doctor); }}
              onDelete={(id) => handleDelete('doctors', id)}
            />
          )}
          
          {currentView === 'patients' && (
            <PatientsView
              patients={patients}
              onAdd={() => { setFormType('patient'); setShowForm(true); setEditingItem(null); }}
              onEdit={(patient) => { setFormType('patient'); setShowForm(true); setEditingItem(patient); }}
              onDelete={(id) => handleDelete('patients', id)}
            />
          )}
          
          {currentView === 'surgeries' && (
            <SurgeriesView
              surgeries={surgeries}
              doctors={doctors}
              patients={patients}
              onAdd={() => { setFormType('surgery'); setShowForm(true); setEditingItem(null); }}
              onEdit={(surgery) => { setFormType('surgery'); setShowForm(true); setEditingItem(surgery); }}
              onDelete={(id) => handleDelete('surgeries', id)}
            />
          )}

          {currentView === 'calendar' && (
            <CalendarView
              surgeries={surgeries}
              doctors={doctors}
              patients={patients}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
            />
          )}
        </main>
      </div>

      {/* Forms Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-96 overflow-y-auto">
            {formType === 'doctor' && (
              <DoctorForm
                doctor={editingItem}
                onSubmit={handleSubmitDoctor}
                onCancel={() => { setShowForm(false); setEditingItem(null); }}
              />
            )}
            {formType === 'patient' && (
              <PatientForm
                patient={editingItem}
                onSubmit={handleSubmitPatient}
                onCancel={() => { setShowForm(false); setEditingItem(null); }}
              />
            )}
            {formType === 'surgery' && (
              <SurgeryForm
                surgery={editingItem}
                doctors={doctors}
                patients={patients}
                onSubmit={handleSubmitSurgery}
                onCancel={() => { setShowForm(false); setEditingItem(null); }}
                onCheckConflict={checkConflict}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Login Screen Component
function LoginScreen({ onLogin, onRegister }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(email, password);
    } else {
      onRegister(email, password);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <img 
            src="https://images.pexels.com/photos/7544433/pexels-photo-7544433.jpeg" 
            alt="Operating Room" 
            className="w-24 h-24 mx-auto rounded-full object-cover mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">OR Scheduler</h1>
          <p className="text-gray-600">Dynamic Operating Room Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Dashboard View Component
function DashboardView({ todaysSurgeries, doctors, patients, selectedDate, setSelectedDate }) {
  const totalSurgeries = todaysSurgeries.length;
  const emergencySurgeries = todaysSurgeries.filter(s => s.is_emergency).length;
  const completedSurgeries = todaysSurgeries.filter(s => s.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <span className="text-2xl">🏥</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Surgeries</p>
              <p className="text-2xl font-bold text-gray-900">{totalSurgeries}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-lg">
              <span className="text-2xl">🚨</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Emergency</p>
              <p className="text-2xl font-bold text-red-600">{emergencySurgeries}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedSurgeries}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <span className="text-2xl">👨‍⚕️</span>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Doctors</p>
              <p className="text-2xl font-bold text-purple-600">{doctors.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Today's Schedule ({selectedDate})</h3>
        </div>
        <div className="p-6">
          {todaysSurgeries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No surgeries scheduled for this date</p>
          ) : (
            <div className="space-y-4">
              {todaysSurgeries.map((surgery) => {
                const doctor = doctors.find(d => d.id === surgery.doctor_id);
                const patient = patients.find(p => p.id === surgery.patient_id);
                
                return (
                  <div key={surgery.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${
                        surgery.is_emergency ? 'bg-red-500' : 
                        surgery.status === 'completed' ? 'bg-green-500' : 
                        surgery.status === 'in_progress' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}></div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {surgery.surgery_time} - OT {surgery.ot_id}
                          {surgery.is_emergency && <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Emergency</span>}
                        </p>
                        <p className="text-sm text-gray-600">
                          Dr. {doctor?.name || 'Unknown'} • {patient?.name || 'Unknown Patient'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{surgery.duration_minutes} min</p>
                      <p className="text-xs text-gray-500 capitalize">{surgery.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Doctors View Component
function DoctorsView({ doctors, onAdd, onEdit, onDelete }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Doctors</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Doctor
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {doctors.map((doctor) => (
                <tr key={doctor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{doctor.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{doctor.specialization}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{doctor.department}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{doctor.email}</div>
                    <div className="text-sm text-gray-500">{doctor.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => onEdit(doctor)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(doctor.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Patients View Component
function PatientsView({ patients, onAdd, onEdit, onDelete }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Patients</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Patient
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age/Gender</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRN</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{patient.age}Y, {patient.gender}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{patient.medical_record_number}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{patient.phone}</div>
                    <div className="text-sm text-gray-500">Emergency: {patient.emergency_contact}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => onEdit(patient)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(patient.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Surgeries View Component
function SurgeriesView({ surgeries, doctors, patients, onAdd, onEdit, onDelete }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">OR Schedules</h2>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Schedule Surgery
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OT</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {surgeries.map((surgery) => {
                const doctor = doctors.find(d => d.id === surgery.doctor_id);
                const patient = patients.find(p => p.id === surgery.patient_id);
                
                return (
                  <tr key={surgery.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{surgery.surgery_date}</div>
                      <div className="text-sm text-gray-500">{surgery.surgery_time} ({surgery.duration_minutes} min)</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">OT {surgery.ot_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{doctor?.name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{doctor?.specialization}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{patient?.name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">MRN: {patient?.medical_record_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        surgery.status === 'completed' ? 'bg-green-100 text-green-800' :
                        surgery.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        surgery.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {surgery.status}
                      </span>
                      {surgery.is_emergency && (
                        <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Emergency
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => onEdit(surgery)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(surgery.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Calendar View Component
function CalendarView({ surgeries, doctors, patients, selectedDate, setSelectedDate }) {
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const currentDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  
  const days = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const getSurgeriesForDate = (day) => {
    if (!day) return [];
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return surgeries.filter(surgery => surgery.surgery_date === dateStr && surgery.status !== 'cancelled');
  };

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Calendar View</h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => {
              if (currentMonth === 0) {
                setCurrentMonth(11);
                setCurrentYear(currentYear - 1);
              } else {
                setCurrentMonth(currentMonth - 1);
              }
            }}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Previous
          </button>
          <span className="text-lg font-medium">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            onClick={() => {
              if (currentMonth === 11) {
                setCurrentMonth(0);
                setCurrentYear(currentYear + 1);
              } else {
                setCurrentMonth(currentMonth + 1);
              }
            }}
            className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
          >
            Next
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 p-3 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
          
          {days.map((day, index) => {
            const daySurgeries = getSurgeriesForDate(day);
            const isToday = day && 
              currentYear === new Date().getFullYear() && 
              currentMonth === new Date().getMonth() && 
              day === new Date().getDate();
            
            return (
              <div
                key={index}
                className={`bg-white p-2 min-h-[100px] ${
                  isToday ? 'bg-blue-50 border-2 border-blue-200' : ''
                }`}
              >
                {day && (
                  <>
                    <div className="text-sm font-medium text-gray-900 mb-1">{day}</div>
                    <div className="space-y-1">
                      {daySurgeries.slice(0, 3).map((surgery) => {
                        const doctor = doctors.find(d => d.id === surgery.doctor_id);
                        return (
                          <div
                            key={surgery.id}
                            className={`text-xs p-1 rounded ${
                              surgery.is_emergency ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {surgery.surgery_time} - OT{surgery.ot_id}
                            <div className="truncate">{doctor?.name}</div>
                          </div>
                        );
                      })}
                      {daySurgeries.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{daySurgeries.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Doctor Form Component
function DoctorForm({ doctor, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: doctor?.name || '',
    specialization: doctor?.specialization || '',
    email: doctor?.email || '',
    phone: doctor?.phone || '',
    department: doctor?.department || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">
        {doctor ? 'Edit Doctor' : 'Add Doctor'}
      </h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
        <input
          type="text"
          value={formData.specialization}
          onChange={(e) => setFormData({...formData, specialization: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
        <input
          type="text"
          value={formData.department}
          onChange={(e) => setFormData({...formData, department: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {doctor ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
}

// Patient Form Component
function PatientForm({ patient, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: patient?.name || '',
    age: patient?.age || '',
    gender: patient?.gender || '',
    medical_record_number: patient?.medical_record_number || '',
    phone: patient?.phone || '',
    emergency_contact: patient?.emergency_contact || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({...formData, age: parseInt(formData.age)});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">
        {patient ? 'Edit Patient' : 'Add Patient'}
      </h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
          <input
            type="number"
            value={formData.age}
            onChange={(e) => setFormData({...formData, age: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData({...formData, gender: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Medical Record Number</label>
        <input
          type="text"
          value={formData.medical_record_number}
          onChange={(e) => setFormData({...formData, medical_record_number: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
        <input
          type="tel"
          value={formData.emergency_contact}
          onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
        />
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {patient ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
}

// Surgery Form Component
function SurgeryForm({ surgery, doctors, patients, onSubmit, onCancel, onCheckConflict }) {
  const [formData, setFormData] = useState({
    patient_id: surgery?.patient_id || '',
    doctor_id: surgery?.doctor_id || '',
    surgery_date: surgery?.surgery_date || '',
    surgery_time: surgery?.surgery_time || '',
    ot_id: surgery?.ot_id || '',
    anesthesiologist: surgery?.anesthesiologist || '',
    anesthesia_type: surgery?.anesthesia_type || '',
    assistant_surgeon: surgery?.assistant_surgeon || '',
    nurses: surgery?.nurses ? surgery.nurses.join(', ') : '',
    pre_op_events: surgery?.pre_op_events || '',
    post_op_events: surgery?.post_op_events || '',
    notes: surgery?.notes || '',
    required_instruments: surgery?.required_instruments || '',
    status: surgery?.status || 'scheduled',
    is_emergency: surgery?.is_emergency || false,
    duration_minutes: surgery?.duration_minutes || 120
  });

  const [conflictCheck, setConflictCheck] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check for conflicts before submitting
    const hasConflict = await onCheckConflict(formData);
    if (hasConflict && !window.confirm('This time slot conflicts with another surgery. Do you want to proceed anyway?')) {
      return;
    }
    
    onSubmit(formData);
  };

  // Check conflicts when key fields change
  useEffect(() => {
    if (formData.surgery_date && formData.surgery_time && formData.ot_id && formData.duration_minutes) {
      const checkConflicts = async () => {
        const hasConflict = await onCheckConflict(formData);
        setConflictCheck(hasConflict);
      };
      checkConflicts();
    }
  }, [formData.surgery_date, formData.surgery_time, formData.ot_id, formData.duration_minutes]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">
        {surgery ? 'Edit Surgery' : 'Schedule Surgery'}
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <select
            value={formData.patient_id}
            onChange={(e) => setFormData({...formData, patient_id: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Patient</option>
            {patients.map(patient => (
              <option key={patient.id} value={patient.id}>{patient.name} - {patient.medical_record_number}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
          <select
            value={formData.doctor_id}
            onChange={(e) => setFormData({...formData, doctor_id: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Doctor</option>
            {doctors.map(doctor => (
              <option key={doctor.id} value={doctor.id}>{doctor.name} - {doctor.specialization}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Surgery Date</label>
          <input
            type="date"
            value={formData.surgery_date}
            onChange={(e) => setFormData({...formData, surgery_date: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Surgery Time</label>
          <input
            type="time"
            value={formData.surgery_time}
            onChange={(e) => setFormData({...formData, surgery_time: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">OT ID</label>
          <select
            value={formData.ot_id}
            onChange={(e) => setFormData({...formData, ot_id: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select OT</option>
            <option value="1">OT 1</option>
            <option value="2">OT 2</option>
            <option value="3">OT 3</option>
            <option value="4">OT 4</option>
            <option value="5">OT 5</option>
          </select>
        </div>
      </div>

      {conflictCheck && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">⚠️ Warning: This time slot conflicts with another surgery!</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
          <input
            type="number"
            value={formData.duration_minutes}
            onChange={(e) => setFormData({...formData, duration_minutes: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="30"
            step="15"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({...formData, status: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesiologist</label>
          <input
            type="text"
            value={formData.anesthesiologist}
            onChange={(e) => setFormData({...formData, anesthesiologist: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesia Type</label>
          <select
            value={formData.anesthesia_type}
            onChange={(e) => setFormData({...formData, anesthesia_type: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select Type</option>
            <option value="General">General</option>
            <option value="Regional">Regional</option>
            <option value="Local">Local</option>
            <option value="Spinal">Spinal</option>
          </select>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Assistant Surgeon (optional)</label>
        <input
          type="text"
          value={formData.assistant_surgeon}
          onChange={(e) => setFormData({...formData, assistant_surgeon: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nurses (comma separated)</label>
        <input
          type="text"
          value={formData.nurses}
          onChange={(e) => setFormData({...formData, nurses: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Nurse 1, Nurse 2, Nurse 3"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Required Instruments</label>
        <textarea
          value={formData.required_instruments}
          onChange={(e) => setFormData({...formData, required_instruments: e.target.value})}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows="2"
        />
      </div>
      
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_emergency}
            onChange={(e) => setFormData({...formData, is_emergency: e.target.checked})}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">Emergency Surgery</span>
        </label>
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {surgery ? 'Update' : 'Schedule'}
        </button>
      </div>
    </form>
  );
}

export default App;