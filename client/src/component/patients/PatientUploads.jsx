// PatientUploads.jsx
import React from 'react';
import '../../styles/PatientUploads.css';

const PatientUploads = ({ patientUploads, handleUploadClick, handleDeleteUploadClick, formatDate }) => (
    <div className="upload-folders-container">
        <div className="upload-folders">
            {patientUploads.length > 0 ? patientUploads.map(upload => (
                <div key={upload._id} className="upload-folder">
                    <img src="/src/assets/images/folderNEW.png" alt="Upload Folder" className="folder-icon" onClick={() => handleUploadClick(upload)} />
                    <div className="icon-container">
                        <div className="upload-info">
                            <p><strong>{new Date(upload.dateUploaded).toLocaleString().split(",")[0]}</strong></p>
                            <p><strong>{upload.bodyPart}</strong></p>
                        </div>
                        <img 
                            src="src/assets/images/bin.png" 
                            alt="Delete" 
                            className="delete-icon" 
                            onClick={(e) => handleDeleteUploadClick(upload._id, e)}
                        />
                    </div>
                </div>
            )) : (
                <p style={{alignContent:'center'}}>No uploads found for this patient.</p>
            )}
        </div>
    </div>
);

export default PatientUploads;
