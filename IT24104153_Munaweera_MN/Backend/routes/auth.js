const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/login', authController.login);
router.get('/demo-account', authController.getDemoAccount);

module.exports = router;
