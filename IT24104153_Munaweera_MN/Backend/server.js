const path = require('path');
const http = require('http');
const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

dotenv.config({
  path: path.resolve(__dirname, '.env'),
  quiet: true,
});

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const User = require('./models/User');
const { hashPassword } = require('./utils/passwords');
const { initializeRealtime } = require('./realtime/socket');

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPort() {
  const rawPort = process.env.PORT?.trim();

  if (!rawPort) {
    return 5000;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer');
  }

  return port;
}

function getMongoUri() {
  return getRequiredEnv('MONGODB_URI');
}

async function connectDB(mongoUri) {
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected successfully');
}

async function ensureDemoStudent() {
  const email = process.env.DEMO_STUDENT_EMAIL?.trim() || 'it24104153@my.sliit.lk';
  const password = process.env.DEMO_STUDENT_PASSWORD?.trim() || 'Student@123';
  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    console.log(`Demo student ready: ${email}`);
    return;
  }

  const hashedPassword = await hashPassword(password);
  await User.create({
    name: 'Munaweera N M',
    email: email.toLowerCase(),
    password: hashedPassword,
    role: 'student',
    status: 'active',
    studentProfile: {
      studentId: 'IT24104153',
      registrationNumber: 'IT24104153',
      department: 'Information Technology',
      specialization: 'Software Engineering',
      academicYear: 'Year 2',
      semester: 'Semester 2',
      program: 'BSc (Hons) in IT',
      campus: 'SLIIT',
    },
  });

  console.log(`Demo student created: ${email}`);
}

const app = express();
const port = getPort();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({
    message: 'Student chat backend is running',
  });
});

app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);

async function startServer() {
  try {
    getRequiredEnv('JWT_SECRET');
    await connectDB(getMongoUri());
    await ensureDemoStudent();
    initializeRealtime(server);

    server.listen(port, '0.0.0.0', () => {
      console.log(`Student chat backend is running on port ${port}`);
    });
  } catch (error) {
    console.error('Server startup failed.', error.message || error);
    process.exit(1);
  }
}

startServer();
