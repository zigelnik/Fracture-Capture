const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const Patient = require('../models/Patient');
const Upload = require('../models/Upload');
const User = require('../models/User');
const requireAuth = require('../middleware/authMiddleware');
const dotenv = require('dotenv').config();

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const router = express.Router();

// Storage for file processing
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// Storage for sending emails
const memoryStorage = multer.memoryStorage();

const uploadToDisk = multer({ storage: diskStorage });
const uploadToMemory = multer({ storage: memoryStorage });
const upload = multer();

router.post('/', requireAuth, uploadToDisk.single('image'), async (req, res) => {
    const { id, description, bodyPart } = req.body;
    const imagePath = req.file.path;

    try {
        const startTime = Date.now(); // Start time

        // Logging request data for debugging
        console.log('Request Data:', { id, description, bodyPart, imagePath });

        const { stdout, stderr } = await execPromise(`python predict.py "${imagePath}"`);
        if (stderr) {
            console.error('Prediction script error:', stderr);
            return res.status(500).json({ error: 'Error running prediction script' });
        }

        let prediction;
        try {
            const jsonString = stdout.match(/\{.*\}/);
            if (jsonString) {
                prediction = JSON.parse(jsonString[0]);
            } else {
                throw new Error("No JSON found in stdout");
            }
        } catch (parseError) {
            console.error('Error parsing prediction output:', parseError);
            return res.status(500).json({ error: 'Error parsing prediction output' });
        }

        const processedImgPath = path.join('uploads', path.basename(prediction.image_path));
        const processedImgId = path.basename(processedImgPath);

        const patient = await Patient.findById(id);
        if (!patient) {
            console.error('Patient not found for ID:', id);
            return res.status(404).json({ error: 'Patient not found' });
        }

        const newUpload = new Upload({
            patient: id,
            patientName: patient.name,
            description,
            dateOfBirth: patient.dateOfBirth,
            bodyPart,
            imgId: req.file.filename,
            imgUrl: `/uploads/${req.file.filename}`,
            processedImgId: processedImgId,
            processedImgUrl: `/uploads/${processedImgId}`,
            dateUploaded: new Date(),
            prediction: { boxes: prediction.boxes, confidences: prediction.confidences },
            createdByUser: req.user.id
        });

        await newUpload.save();

        const endTime = Date.now(); // End time
        const processingTime = (endTime - startTime) / 1000; // Processing time in seconds

        res.status(201).json({ 
            newUpload, 
            processedImagePath: newUpload.processedImgUrl,
            processingTime  // Send processing time to frontend
        });
    } catch (error) {
        console.error('Error uploading:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Endpoint to fetch uploads for a specific patient
const mongoose = require('mongoose');

// Ensure `id` is a valid ObjectId before querying
router.get('/:id', requireAuth, async (req, res) => {
    const patientId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
        console.error('Invalid ObjectId:', patientId);
        return res.status(400).json({ error: 'Invalid patient ID' });
    }

    try {
        const uploads = await Upload.find({ patient: patientId }).exec();
        res.json(uploads);
    } catch (error) {
        console.error('Error fetching uploads:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Endpoint to delete an upload
router.delete('/:uploadId', requireAuth, async (req, res) => {
    try {
        const upload = await Upload.findById(req.params.uploadId);
        if (!upload) {
            return res.status(404).json({ error: 'Upload not found' });
        }

        const filePaths = [
            path.join(__dirname, '../uploads', upload.imgId),
            path.join(__dirname, '../uploads', upload.processedImgId)
        ];

        // Function to delete a file and return a promise
        const deleteFile = (filePath) => new Promise((resolve, reject) => {
            fs.unlink(filePath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    // If error is not "file not found"
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        // Delete image and processed image files
        await Promise.all(filePaths.map(deleteFile));

        // Delete the upload document
        await Upload.findByIdAndDelete(req.params.uploadId);
        res.json({ message: 'Upload deleted successfully' });
    } catch (error) {
        console.error('Error deleting upload:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.post('/send-email', upload.single('pdf'), async (req, res) => {
    const { patientName, email } = req.body;
    const pdfBuffer = req.file.buffer;

    const transporter = req.app.locals.emailTransporter;

    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: 'Prediction Results',
        html: `Please find attached the upload details for the patient <strong>${patientName}</strong>.
        <br>Thanks, the FractureCapture team.`,
        attachments: [
            {
                filename: `upload_details_${patientName}.pdf`,
                content: pdfBuffer,
            },
        ],
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ error: 'Error sending email. Please try again later.' });
    }
});

router.post('/share', requireAuth, async (req, res) => {
    const { uploadId, email } = req.body;

    try {
        // Ensure upload exists
        const upload = await Upload.findById(uploadId).populate('patient createdByUser');
        if (!upload) {
            console.error('Upload not found');
            return res.status(404).json({ error: 'Upload not found' });
        }

        // Ensure recipient doctor exists
        const recipientDoctor = await User.findOne({ email });
        if (!recipientDoctor) {
            console.error('Recipient doctor not found');
            return res.status(404).json({ error: 'Recipient doctor not found' });
        }

        // Add shared upload to recipient's profile with patient details
        recipientDoctor.sharedUploads = recipientDoctor.sharedUploads || [];
        if (!recipientDoctor.sharedUploads.some((sharedUpload) => sharedUpload.toString() === upload._id.toString())) {
            recipientDoctor.sharedUploads.push(upload._id);
        }

        await recipientDoctor.save();

        res.status(200).json({ message: 'Upload details shared successfully' });
    } catch (error) {
        console.error('Error sharing upload details:', error.message);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Backend Route for Sharing a Patient
router.post('/share/patient/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { email } = req.body;

    try {
        const patient = await Patient.findById(id).populate('uploads'); // Populating uploads
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const recipientDoctor = await User.findOne({ email });
        if (!recipientDoctor) {
            return res.status(404).json({ error: 'Recipient doctor not found' });
        }

        // Check if patient is already shared
        recipientDoctor.sharedPatients = recipientDoctor.sharedPatients || [];
        if (!recipientDoctor.sharedPatients.some(sharedPatient => sharedPatient.toString() === patient._id.toString())) {
            recipientDoctor.sharedPatients.push(patient._id);
        }

        await recipientDoctor.save();

        res.status(200).json({ message: 'Patient shared successfully', sharedPatient: patient });
    } catch (error) {
        console.error('Error sharing patient:', error.message);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});
// Route to fetch uploads for a specific patient (shared)
router.get('/shared/:patientId', requireAuth, async (req, res) => {
    const { patientId } = req.params;

    try {
        // Fetch uploads and populate patient and createdByUser fields
        const uploads = await Upload.find({ patient: patientId })
            .populate('patient') // Populate patient details
            .populate('createdByUser'); // Populate user details who created the upload

        res.json(uploads);
    } catch (error) {
        console.error('Error fetching uploads for shared patient:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// Example of using $pull operator
router.delete('/shared-upload/:uploadId', requireAuth, async (req, res) => {
    const { uploadId } = req.params;
    const userId = req.user.id;

    try {
        const result = await User.updateOne(
            { _id: userId },
            { $pull: { sharedUploads: uploadId } }
        );

        if (result.nModified === 0) {
            return res.status(404).json({ error: 'Upload not found or already removed.' });
        }

        res.status(200).json({ message: 'Shared upload removed successfully' });
    } catch (error) {
        console.error('Error removing shared upload:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;