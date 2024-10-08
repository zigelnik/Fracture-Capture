/**
 * Patients Results Page
 * 
 * This component serves as the main profile and results management page for the application. It allows the user 
 * to view, edit, and manage patient information and their associated uploads. Additionally, it provides 
 * functionality to share patient data with other doctors via email.
 * 
 * Key Functionalities:
 * 
 * 1. **View and Search Patients**:
 *    - Displays a list of all patients associated with the logged-in user.
 *    - Allows the user to search for patients by name or ID using a search bar.
 * 
 * 2. **Manage Patient Data**:
 *    - Enables users to view detailed information about a selected patient, including all uploads associated with that patient.
 *    - Users can edit patient details or delete a patient, which will also remove all associated uploads.
 * 
 * 3. **Manage Patient Uploads**:
 *    - Users can view individual uploads for a patient and see details about each upload.
 *    - Allows users to delete specific uploads from the patient's profile.
 * 
 * 4. **Share Patient Uploads**:
 *    - Users can share patient data and uploads with other doctors via email. The component includes a modal form 
 *      for entering the email address of the doctor to share the data with.
 *    - Prevents users from sharing data with themselves to avoid redundant actions.
 * 
 * 5. **Navigation and State Management**:
 *    - Uses React Router's `useNavigate` to redirect users if they are not authenticated or if errors occur during data fetching.
 *    - Manages various states for the profile, search query, selected patient, patient uploads, editing patient, etc.
 * 
 * Hooks Used:
 * - `useState`: Manages local state for profile data, search query, selected patient, uploads, editing states, email inputs, etc.
 * - `useEffect`: Fetches the initial profile data from the server when the component mounts.
 * - `useNavigate`: Redirects users to the login page if fetching profile data fails due to authentication errors.
 * 
 * Component Structure:
 * - Initially displays a list of patients and allows users to search through them.
 * - On selecting a patient, displays all uploads associated with that patient.
 * - On selecting an upload, displays detailed information about the upload.
 * - Includes options to edit or delete patients and uploads, and to share data with other doctors.
 * 
 * External Dependencies:
 * - `axios`: Used for making HTTP requests to fetch and manipulate patient data.
 * - `react-hot-toast`: Provides notifications for success and error feedback to the user.
 * - `react-router-dom`: Facilitates navigation and redirects within the application.
 * - `react-modal`: Provides a modal for sharing patient data with other doctors.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import Modal from 'react-modal';
import PatientList from '../component/patients/PatientList';
import PatientUploads from '../component/patients/PatientUploads';
import UploadDetails from '../component/patients/UploadDetails';
import PatientForm from '../component/PatientForm';
import '../styles/PatientsResults.css';

Modal.setAppElement('#root');

export default function Profile() {
    const [profile, setProfile] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [patientUploads, setPatientUploads] = useState([]);
    const [selectedUpload, setSelectedUpload] = useState(null);
    const [editingPatient, setEditingPatient] = useState(null);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [selectedSharePatient, setSelectedSharePatient] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        axios.get('/user/profile', { withCredentials: true })
            .then(response => setProfile(response.data))
            .catch(error => {
                console.error('Error fetching profile:', error.response ? error.response.data : error.message);
                navigate('/login');
            });
    }, [navigate]);

    const filteredPatients = profile ? profile.patients.filter(patient => {
        return (
            patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            patient.idNumber.includes(searchQuery)
        );
    }) : [];

    const fetchPatientUploads = (id) => {
        axios.get(`/uploads/${id}`, { withCredentials: true })
            .then(response => {
                setPatientUploads(response.data);
                const patient = profile.patients.find(p => p._id === id);
                if (patient) {
                    setSelectedPatient(patient);
                } else {
                    console.error('Patient not found in profile');
                }
                setSelectedUpload(null);
            })
            .catch(error => {
                console.error('Error fetching patient uploads:', error.response ? error.response.data : error.message);
            });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    };

    const handleUploadClick = (upload) => {
        setSelectedUpload(upload);
    };

    const handleBackClick = () => {
        if (selectedUpload) {
            setSelectedUpload(null);
        } else if (selectedPatient) {
            setSelectedPatient(null);
            setPatientUploads([]);
        }
    };

    const handleDeleteUploadClick = (uploadId, e) => {
        e.stopPropagation();
        toast(
            (t) => (
                <span>
                    Are you sure you want to delete this upload?
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button
                            onClick={() => confirmDeleteUpload(uploadId, t.id)}
                            style={{
                                padding: '5px 10px',
                                backgroundColor: 'orange',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: 'white',
                            }}
                        >
                            Yes
                        </button>
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            style={{
                                padding: '5px 10px',
                                backgroundColor: '#ccc',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: 'black',
                            }}
                        >
                            No
                        </button>
                    </div>
                </span>
            ),
            { duration: 3000 }
        );
    };

    const confirmDeleteUpload = (uploadId, toastId) => {
        axios.delete(`/uploads/${uploadId}`, { withCredentials: true })
            .then(response => {
                setPatientUploads(uploads => uploads.filter(upload => upload._id !== uploadId));
                toast.dismiss(toastId);
                toast.success('Upload deleted successfully.');
            })
            .catch(error => {
                console.error('Error deleting upload:', error.response ? error.response.data : error.message);
                toast.error('Failed to delete upload.');
            });
    };

    const handleDeletePatientClick = (id, e) => {
        e.stopPropagation();
        toast(
            (t) => (
                <span>
                    Are you sure you want to delete this patient and all of its uploads?
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button
                            onClick={() => confirmDeletePatient(id, t.id)}
                            style={{
                                padding: '5px 10px',
                                backgroundColor: 'orange',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: 'white',
                            }}
                        >
                            Yes
                        </button>
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            style={{
                                padding: '5px 10px',
                                backgroundColor: '#ccc',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: 'black',
                            }}
                        >
                            No
                        </button>
                    </div>
                </span>
            ),
            { duration: 3000 }
        );
    };

    const confirmDeletePatient = (id, toastId) => {
        axios.delete(`/patients/${id}`, { withCredentials: true })
            .then(response => {
                setProfile(profile => ({
                    ...profile,
                    patients: profile.patients.filter(patient => patient._id !== id)
                }));
                if (selectedPatient && selectedPatient._id === id) {
                    setSelectedPatient(null);
                    setPatientUploads([]);
                }
                toast.dismiss(toastId);
                toast.success('Patient deleted successfully.');
            })
            .catch(error => {
                console.error('Error deleting patient:', error.response ? error.response.data : error.message);
                toast.error('Failed to delete patient.');
            });
    };

    const handleEditPatientClick = (patient, e) => {
        e.stopPropagation();
        setEditingPatient(patient);
    };

    const handleEditPatientChange = (e) => {
        const { name, value } = e.target;
        setEditingPatient({ ...editingPatient, [name]: value });
    };

    const handleEditPatientSubmit = (e) => {
        e.preventDefault();
        axios.put(`/patients/${editingPatient._id}`, editingPatient, { withCredentials: true })
            .then(response => {
                setProfile(profile => ({
                    ...profile,
                    patients: profile.patients.map(patient =>
                        patient._id === editingPatient._id ? editingPatient : patient
                    )
                }));
                if (selectedPatient && selectedPatient._id === editingPatient._id) {
                    setSelectedPatient(editingPatient);
                }
                setEditingPatient(null);
            })
            .catch(error => {
                console.error('Error updating patient:', error.response ? error.response.data : error.message);
            });
    };
    const handleSharePatientUploads = async (e) => {
        e.preventDefault();
        try {
            if (email === profile.email) {
                setMessage("You cannot share with yourself.");
                return;
            }
            const response = await axios.post(`/uploads/share/patient/${selectedSharePatient}`, {
                email
            }, { withCredentials: true });
            setMessage(response.data.message);
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error sharing patient uploads:', error);
            setMessage('Error sharing patient uploads');
        }
    };

    const handleSelectSharePatient = (id) => {
        setSelectedSharePatient(id);
        setMessage('');
        setEmail('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    if (!profile) {
        return <div>Loading...</div>;
    }

    return (
        <div className="profile-container">
            <h1>Results Page</h1>
                      <img 
                src="/src/assets/images/undo.png" 
                alt="Back" 
                className="back-button-icon" 
                onClick={handleBackClick} 
            />
            <div className="search-folders-container">
                {!selectedPatient && !selectedUpload && (
                    <input
                        type="text"
                        placeholder="Search by Name or ID"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="search-bar"
                    />
                )}
                {editingPatient ? (
                    <PatientForm
                        newPatient={editingPatient}
                        handleInputChange={handleEditPatientChange}
                        handleSubmit={handleEditPatientSubmit}
                        handleBackClick={() => setEditingPatient(null)}
                        isEditing={true}
                    />
                ) : selectedUpload ? (
                    <UploadDetails
                        selectedUpload={selectedUpload}
                        handleBackClick={handleBackClick}
                        patient={selectedPatient}
                    />
                ) : selectedPatient ? (
                    <PatientUploads
                        patientUploads={patientUploads}
                        handleUploadClick={handleUploadClick}
                        handleDeleteUploadClick={handleDeleteUploadClick}
                        formatDate={formatDate}
                        handleBackClick={handleBackClick}
                    />
                ) : (
                    <PatientList
                        patients={filteredPatients}
                        fetchPatientUploads={fetchPatientUploads}
                        handleEditPatientClick={handleEditPatientClick}
                        handleDeletePatientClick={handleDeletePatientClick}
                        handleSelectSharePatient={handleSelectSharePatient}
                    />
                )}
            </div>
            <Modal
                isOpen={isModalOpen}
                onRequestClose={closeModal}
                contentLabel="Share Patient Uploads"
                className="Modal"
                overlayClassName="Overlay"
            >
                <h2>Share patient folder</h2>
                <form onSubmit={handleSharePatientUploads}>
                    <label>
                        Doctor's Email:
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter doctor's email"
                            required
                            style={{ display: 'block', marginTop: '5px', padding: '5px', width: '100%' }}
                        />
                    </label>
                    <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer' }}>Share</button>
                </form>
                {message && <p>{message}</p>}
            </Modal>
        </div>
    );    
}
