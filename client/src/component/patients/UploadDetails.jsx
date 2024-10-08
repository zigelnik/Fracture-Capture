import React, { useState, useEffect } from 'react';
import downloadIcon from '../../assets/images/download-file-icon.png';
import sendEmailIcon from '../../assets/images/send-email-icon.png';
import shareIcon from '../../assets/images/share-folder-icon.png';
import axios from 'axios';
import { createPDF, sendEmail } from '../../utils/pdfUtils';
import { toast } from 'react-hot-toast';
import '../../styles/UploadDetails.css';

const UploadDetails = ({ selectedUpload, handleBackClick, patient }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [createdByUser, setCreatedByUser] = useState({});
    const [email, setEmail] = useState('');
    const [shareEmail, setShareEmail] = useState('');
    const [message, setMessage] = useState('');
    const [showShareInput, setShowShareInput] = useState(false);
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [isSending, setIsSending] = useState(false);

    useEffect(() => {
        if (selectedUpload?.createdByUser) {
            fetchCreatedByUser(selectedUpload.createdByUser);
        }
    }, [selectedUpload]);

    const fetchCreatedByUser = async (userId) => {
        try {
            const response = await axios.get(`/user/${userId}`, { withCredentials: true });
            setCreatedByUser(response.data);
        } catch (error) {
            console.error('Error fetching created by user:', error.response ? error.response.data : error.message);
        }
    };

    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const handleEmailChange = (e) => {
        setEmail(e.target.value);
    };

    const handleShareEmailChange = (e) => {
        setShareEmail(e.target.value);
    };

    const downloadPDF = async () => {
        const pdf = await createPDF(selectedUpload, patient, createdByUser, imageLoaded);
        if (pdf) {
            pdf.save(`upload_details_${selectedUpload.patientName || 'unknown'}.pdf`);
        }
    };

    const handleShareSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:8000/uploads/share', {
                uploadId: selectedUpload._id,
                email: shareEmail,
            });
            setMessage(response.data.message);
            setShareEmail('');
        } catch (error) {
            console.error('Error sharing upload:', error);
            console.error('Error details:', error.response ? error.response.data : error.message);
            setMessage('Error sharing upload');
        }
    };

    if (!selectedUpload || !selectedUpload.processedImgUrl) {
        return <p>No upload selected or missing image URL.</p>;
    }

    return (
        <>
            <div className="upload-details">
                <div id="pdf-content">
                    <p><strong>Patient Name:</strong> <span>{selectedUpload.patientName || 'N/A'}</span></p>
                    <p><strong>Patient ID:</strong> <span>{patient?.idNumber || selectedUpload.patient?.idNumber || 'N/A'}</span></p>
                    <p><strong>Gender:</strong> <span>{patient?.gender || selectedUpload.patient?.gender || 'N/A'}</span></p>
                    <p><strong>Date of Birth:</strong> <span>{new Date(patient?.dateOfBirth || selectedUpload.patient?.dateOfBirth).toLocaleDateString() || 'N/A'}</span></p>
                    <p><strong>Associated doctor:</strong> <span>{createdByUser.name} ({createdByUser.email})</span></p>
                    <p><strong>Body Part:</strong> <span>{selectedUpload.bodyPart}</span></p>
                    <p><strong>Description:</strong> <span>{selectedUpload.description}</span></p>
                    <p><strong>Date Uploaded:</strong> <span>{new Date(selectedUpload.dateUploaded).toLocaleString()}</span></p>
                    <p><strong>Prediction:</strong> <span>{selectedUpload.prediction.confidences.length > 0 
                        ? selectedUpload.prediction.confidences.map(conf => `${(conf * 100).toFixed(2)}%`).join(', ')
                        : 'No fracture detected'}
                    </span></p>
                    <img 
                        src={`http://localhost:8000${selectedUpload.processedImgUrl}`} 
                        alt="Processed Upload" 
                        onLoad={handleImageLoad} 
                        className="processed-image" 
                    />
                </div>
                <div className="action-icons">
                    <img 
                        src={downloadIcon} 
                        alt="Download as PDF" 
                        onClick={downloadPDF} 
                        className="icon"
                    />
                    <img 
                        src={shareIcon}
                        alt="Share to another Dr." 
                        onClick={() => setShowShareInput(!showShareInput)}
                        className="icon"
                    />
                    <img 
                        src={sendEmailIcon}
                        alt="Send as Email" 
                        onClick={() => setShowEmailInput(!showEmailInput)}
                        className="icon"
                    />
                </div>

                {showEmailInput && (
                    <form 
                        onSubmit={(e) => { 
                            e.preventDefault(); 
                            if (!email) {
                                toast.error('Please enter a valid email address.');
                                return;
                            }
                            sendEmail(selectedUpload, email, imageLoaded, setIsSending, setShowEmailInput, setEmail, patient, createdByUser); 
                        }} 
                        className="email-form"
                    >
                        <input
                            type="email"
                            value={email}
                            onChange={handleEmailChange}
                            placeholder="Enter recipient email"
                            className="email-input"
                            disabled={isSending}
                        />
                        <button type="submit" className="form-button" disabled={isSending}>
                            {isSending ? 'Sending...' : 'Send'}
                        </button>
                    </form>
                )}

                {showShareInput && (
                    <form onSubmit={handleShareSubmit} className="email-form">
                        <label>
                            <p>Share with another doctor:</p>
                            <input
                                type="email"
                                value={shareEmail}
                                placeholder="Enter doctor's email"
                                onChange={handleShareEmailChange}
                                required
                                className="email-input"
                            />
                        </label>
                        <button type="submit" className="form-button">Share</button>
                    </form>
                )}
                {message && <p className="message">{message}</p>}
            </div>
        </>
    );
};

export default UploadDetails;
