const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const session = require('express-session');

dotenv.config({ path: require('path').join(__dirname, '../../.env') });

const authRouter = require('./routes/auth');
const talentRouter = require('./routes/talent');
const fileRouter = require('./routes/files');
const assessmentRouter = require('./routes/assessment');
const adminRouter = require('./routes/admin');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-with-strong-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Routes
app.use('/auth', authRouter);
app.use('/api/talent', talentRouter);
app.use('/api/files', fileRouter);
app.use('/api/assessment', assessmentRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
