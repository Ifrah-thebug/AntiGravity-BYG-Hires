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
const voiceInterviewRouter = require('./routes/voiceInterview');
const adminRouter = require('./routes/admin');
const calRouter = require('./routes/cal');
const introRouter = require('./routes/intro');
const profilePhotoRouter = require('./routes/profilePhoto');
const clientRouter = require('./routes/client');
const calWebhookRouter = require('./routes/calWebhook');
const adminTalentImportRouter = require('./routes/adminTalentImport');
const adminProfileReviewRouter = require('./routes/adminProfileReview');
const talentProfileReviewRouter = require('./routes/talentProfileReview');
const talentInviteRouter = require('./routes/talentInvite');
const cronRouter = require('./routes/cron');
const passwordResetRouter = require('./routes/passwordReset');
const sitemapRouter = require('./routes/sitemap');
const openRouterClient = require('./services/openRouterClient');
const { useConsoleProvider } = require('./services/resendEmailService');

const app = express();

// Trust the Nginx reverse proxy (req.ip, secure cookies, rate-limit X-Forwarded-For)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
const corsOrigins = [
  process.env.CLIENT_URI,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || corsOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  exposedHeaders: ['X-Photo-Sharp', 'X-Photo-Leonardo', 'X-Photo-Model', 'X-Photo-Heic', 'X-Photo-Pipeline'],
}));
// Cal.com webhooks need the raw body for signature verification.
app.use(
  '/api/cal/webhook',
  express.raw({ type: 'application/json' }),
  calWebhookRouter
);
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
app.use('/api/voice-interview', voiceInterviewRouter);
app.use('/api/admin', adminRouter);
app.use('/api/cal', calRouter);
app.use('/api/intro', introRouter);
app.use('/api/profile', profilePhotoRouter);
app.use('/api/client', clientRouter);
app.use('/api/admin/talent-import', adminTalentImportRouter);
app.use('/api/admin/profile-review', adminProfileReviewRouter);
app.use('/api/talent/profile', talentProfileReviewRouter);
app.use('/api/talent-invite', talentInviteRouter);
app.use('/api/auth', passwordResetRouter);
app.use('/api/internal/cron', cronRouter);
app.use(sitemapRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
  if (process.env.LEONARDO_API_KEY) {
    console.log(
      `[profilePhoto] Leonardo AI (${process.env.LEONARDO_MODEL || 'nano-banana-2'}) enhancement enabled`
    );
  } else {
    console.log(
      '[profilePhoto] LEONARDO_API_KEY not set — sharp-only crop fallback for /api/profile/enhance-photo'
    );
  }
  if (useConsoleProvider()) {
    if (process.env.EMAIL_PROVIDER === 'console') {
      console.log('[email] EMAIL_PROVIDER=console — activation links logged to console');
    } else {
      console.log(
        '[email] RESEND_API_KEY missing in .env — activation links logged to console (save project root .env and restart backend)'
      );
    }
  } else {
    console.log('[email] Resend client activation emails enabled');
  }
  const webhookBase = (process.env.BACKEND_PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
  console.log(`[cal] Discovery webhook: POST ${webhookBase}/api/cal/webhook`);
  if (!process.env.CAL_WEBHOOK_SECRET) {
    console.log('[cal] CAL_WEBHOOK_SECRET not set — webhook signatures not verified (set in production)');
  }
  if (process.env.CRON_SECRET) {
    console.log('[cron] Talent reminder endpoint: POST /api/internal/cron/talent-reminders');
  } else {
    console.log('[cron] CRON_SECRET not set — scheduled talent reminders disabled');
  }
  const siteUrl = (process.env.SITE_URL || process.env.FRONTEND_URL || 'https://byghires.com').replace(/\/$/, '');
  console.log(`[sitemap] ${siteUrl}/sitemap.xml (gzip, cached)`);
  console.log(`[sitemap] ${siteUrl}/robots.txt`);
  const openRouter = openRouterClient;
  if (openRouter.isOpenRouterEnabled()) {
    console.log(
      `[openRouter] Assessment fallback enabled — models: ${openRouter.getGenerateModelChain().join(', ')}`
    );
  }
});
