const express = require('express');
const bcrypt = require('bcryptjs');
const requireAuth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Upload = require('../models/Upload');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const router = express.Router();

/**
 * User Profile and Management Routes
 */

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password').lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const patients = await Patient.find({ createdByUser: req.user.id });
        res.json({ ...user, patients });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Change user password
router.post('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if current password matches
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash the new password and update the user
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user by admin
router.put('/update/:userId', requireAuth, async (req, res) => {
    const { userId } = req.params;
    const { name, email } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.name = name;
        user.email = email;
        await user.save();

        res.status(200).json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all users (Admin only)
router.get('/all-users', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const users = await User.find().select('-password').lean();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user by ID
router.get('/:id', requireAuth, async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
        const user = await User.findById(req.params.id).select('-password').lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user by admin
router.delete('/delete/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        const patients = await Patient.find({ createdByUser: userId });

        for (const patient of patients) {
            const uploads = await Upload.find({ patient: patient._id });
            for (const upload of uploads) {
                const filePaths = [
                    path.join(__dirname, '../uploads', upload.imgId),
                    path.join(__dirname, '../uploads', upload.processedImgId)
                ];
                await Promise.all(filePaths.map(deleteFile));
            }
            await Upload.deleteMany({ patient: patient._id });
        }

        await Patient.deleteMany({ createdByUser: userId });
        await User.findByIdAndDelete(userId);

        res.json({ message: 'User, their patients, and all associated uploads deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Shared Uploads and Patients Management Routes
 */

// Get shared uploads and patients
router.get('/shared-uploads', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate({
                path: 'sharedUploads',
                populate: { path: 'patient', model: 'Patient' }
            })
            .populate('sharedPatients');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const sharedPatients = user.sharedPatients;
        const sharedUploads = user.sharedUploads;

        res.json({ sharedPatients, sharedUploads });
    } catch (error) {
        console.error('Error fetching shared uploads:', error.message);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Remove a shared upload
router.delete('/shared-upload/:uploadId', requireAuth, async (req, res) => {
    const { uploadId } = req.params;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.sharedUploads = user.sharedUploads.filter(id => id.toString() !== uploadId);
        await user.save();

        res.status(200).json({ message: 'Shared upload removed successfully' });
    } catch (error) {
        console.error('Error removing shared upload:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove a shared patient
router.delete('/shared-patient/:patientId', requireAuth, async (req, res) => {
    const { patientId } = req.params;
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.sharedPatients = user.sharedPatients.filter(id => id.toString() !== patientId);
        await user.save();

        res.status(200).json({ message: 'Shared patient removed successfully' });
    } catch (error) {
        console.error('Error removing shared patient:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Utility Functions
 */

// Function to delete a file and return a promise
const deleteFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

module.exports = router;
