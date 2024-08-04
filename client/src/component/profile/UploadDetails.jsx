import React, { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import axios from 'axios';
import downloadIcon from '../../assets/images/download-file-icon.png';

const UploadDetails = ({ selectedUpload, handleBackClick }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const downloadPDF = () => {
        if (!imageLoaded) return;

        const input = document.getElementById('pdf-content');
        html2canvas(input, {
            useCORS: true,
            scale: 2,
            backgroundColor: '#ffffff',
        }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            pdf.addImage(imgData, 'PNG', 10, 0, 190, 160);

            const yOffset = 190;
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Patient Name:', 10, yOffset);
            pdf.setFont('helvetica', 'normal');
            pdf.text(` ${selectedUpload.patientName}`, 45, yOffset);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Description:', 10, yOffset + 10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(` ${selectedUpload.description}`, 45, yOffset + 10);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Body Part:', 10, yOffset + 20);
            pdf.setFont('helvetica', 'normal');
            pdf.text(` ${selectedUpload.bodyPart}`, 45, yOffset + 20);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Date Uploaded:', 10, yOffset + 30);
            pdf.setFont('helvetica', 'normal');
            pdf.text(` ${new Date(selectedUpload.dateUploaded).toLocaleString()}`, 45, yOffset + 30);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Prediction:', 10, yOffset + 40);
            pdf.setFont('helvetica', 'normal');

            const confidenceText = selectedUpload.prediction.confidences.length > 0 
                ? selectedUpload.prediction.confidences.map(conf => `${(conf * 100).toFixed(2)}%`).join(', ')
                : 'No fracture detected';
            pdf.text(` ${confidenceText}`, 45, yOffset + 40);

            pdf.save(`upload_details_${selectedUpload.patientName}.pdf`);
        });
    };

    const handleShareSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('/uploads/share', {
                uploadId: selectedUpload._id,
                email
            });
            setMessage(response.data.message);
        } catch (error) {
            console.error('Error sharing upload:', error);
            setMessage('Error sharing upload');
        }
    };

    return (
        <div className="upload-details">
            <img 
                src="/src/assets/images/undo.png" 
                alt="Back to Patients" 
                className="back-button-icon" 
                onClick={handleBackClick} 
                style={{ margin: '0 auto', marginBottom: '20px' }}
            />
            <div id="pdf-content">
                <p><strong>Patient Name:</strong> {selectedUpload.patientName}</p>
                <p><strong>Description:</strong> {selectedUpload.description}</p>
                <p><strong>Body Part:</strong> {selectedUpload.bodyPart}</p>
                <p><strong>Date Uploaded:</strong> {new Date(selectedUpload.dateUploaded).toLocaleString()}</p>
                <p><strong>Prediction:</strong> {selectedUpload.prediction.confidences.length > 0 
                    ? selectedUpload.prediction.confidences.map(conf => `${(conf * 100).toFixed(2)}%`).join(', ')
                    : 'No fracture detected'}
                </p>
                <img 
                    src={`http://localhost:8000${selectedUpload.processedImgUrl}`} 
                    alt="Processed Upload" 
                    onLoad={handleImageLoad} 
                    crossOrigin="anonymous"
                    style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto', marginTop: '15px' }}
                />
            </div>
            <img 
                src={downloadIcon} 
                alt="Download as PDF" 
                onClick={downloadPDF} 
                style={{ cursor: 'pointer', width: '60px', margin: '0 auto', marginTop: '30px' }}
            />

            <form onSubmit={handleShareSubmit} style={{ marginTop: '20px' }}>
                <label>
                    Share with another doctor:
                    <input
                        type="email"
                        value={email}
                        placeholder="Enter doctor's email"
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ display: 'block', marginTop: '5px', padding: '5px', width: '100%' }}
                    />
                </label>
                <button type="submit" style={{ padding: '10px 20px', cursor: 'pointer' }}>Share</button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default UploadDetails;
