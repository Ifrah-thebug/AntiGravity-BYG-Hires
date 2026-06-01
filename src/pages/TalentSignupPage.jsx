// src/pages/TalentSignupPage.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
  UploadCloud, Camera, FileText, X, AlertTriangle,
  CheckCircle2, ChevronRight, Mail, Lock, User, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { parseCV, GEMINI_CV_MODEL } from '../lib/geminiCV';
import { supabase } from '../lib/supabase';
import { formatAuthError } from '../lib/talentAuth';
import { savePendingSetup, uploadSignupFiles } from '../lib/talentStorage';
import { useProfilePhotoUpload } from '../lib/useProfilePhotoUpload';
import { normalizeProfileName } from '../lib/formatDisplayName';
import {
  formatProfileValidationErrors,
  validateProfileFields,
} from '../lib/profileContentPolicy';

const TalentSignupPage = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [cvFile, setCvFile] = useState(null);
  const [error, setError] = useState('');
  const {
    photoFile,
    photoPreview,
    photoProcessing,
    handlePhotoSelect,
    clearPhoto,
    getPhotoDataUrl,
  } = useProfilePhotoUpload({ onError: setError });
  const [step, setStep] = useState('idle'); // idle | auth | parsing | uploading | done
  const [emailConfirmPending, setEmailConfirmPending] = useState(false);

  const handleInput = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleCV = (e) => {
    const f = e.target.files?.[0];
    if (f) { setCvFile(f); setError(''); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.email || !form.password || !cvFile || !photoFile) {
      setError('Please fill all fields and upload both your CV and photo.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const normalizedName = normalizeProfileName(form.name);
    const signupFieldErrors = validateProfileFields({
      name: normalizedName,
      job_title: '',
      about: '',
      skills: [],
    });
    if (signupFieldErrors.length) {
      setError(formatProfileValidationErrors(signupFieldErrors));
      return;
    }

    try {
      setStep('auth');
      await signUp(form.email, form.password, { full_name: normalizedName });

      const { data: { session } } = await supabase.auth.getSession();

      setStep('parsing');
      const cvBase64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onloadend = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(cvFile);
      });
      const cvParsed = await parseCV(
        cvBase64.split(',')[1],
        cvFile.type || 'application/pdf'
      );

      const photoBase64 = await getPhotoDataUrl();

      const setupBase = {
        name: normalizeProfileName(form.name || cvParsed.name || ''),
        email: form.email,
        parsed: cvParsed,
        photoUrl: photoBase64,
        cvUrl: '',
        uploadWarnings: [],
      };

      if (!session) {
        savePendingSetup(setupBase);
        setEmailConfirmPending(true);
        setStep('done');
        return;
      }

      setStep('uploading');
      const { cvUrl, photoUrl, warnings } = await uploadSignupFiles(
        session.user.id,
        cvFile,
        photoFile
      );

      setStep('done');
      navigate('/talent/setup', {
        state: {
          userId: session.user.id,
          email: form.email,
          name: setupBase.name,
          parsed: cvParsed,
          cvUrl: cvUrl || '',
          photoUrl: photoUrl || photoBase64,
          cvFile,
          photoFile,
          uploadWarnings: warnings,
        },
      });
    } catch (err) {
      setStep('idle');
      setEmailConfirmPending(false);
      setError(formatAuthError(err));
    }
  };

  const isLoading = step !== 'idle' && step !== 'done' && !emailConfirmPending;

  return (
    <div className="bg-white min-h-screen font-sans pb-24 pt-20">
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center text-center p-8"
          >
            <div className="w-16 h-16 border-4 border-red/20 border-t-red rounded-full animate-spin mb-6" />
            <h3 className="text-white font-black text-xl uppercase tracking-wider mb-2">
              {step === 'auth'
                ? 'Creating Your Account…'
                : step === 'uploading'
                  ? 'Uploading Your Files…'
                  : 'Parsing Your CV with AI…'}
            </h3>
            <p className="text-gray-400 text-xs font-mono max-w-xs">
              {step === 'auth'
                ? 'Registering you with BYG Hires.'
                : step === 'uploading'
                  ? 'Saving your CV and photo to secure storage.'
                  : `Calling ${GEMINI_CV_MODEL} — extracting your profile…`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-16 pb-16 px-6 bg-black text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red rounded-full blur-[160px] opacity-20 -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red rounded-full blur-[140px] opacity-10 -ml-20 -mb-20"></div>

        <div className="max-w-4xl mx-auto flex flex-col items-center text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative inline-block mb-6"
          >
            <h1 className="text-4xl md:text-6xl font-black mb-4 leading-[1.05] tracking-tight text-white uppercase">
              Prove your craft.<br />
              <span className="text-red">Skip the queue.</span>
            </h1>
            <div className="w-20 h-1.5 bg-red mt-4 mx-auto" />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-gray-400 max-w-xl text-sm md:text-base leading-relaxed font-medium mb-4"
          >
            No resume roulette. Complete a real-world task assessment, get scored, and make your profile stronger with your score.
          </motion.p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 mt-10 relative z-20">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-black tracking-tight leading-tight mb-3">
            Create your profile.
          </h2>
          <p className="text-gray-500 text-sm font-medium max-w-sm mx-auto">
            Upload your CV — our AI will build your profile in seconds. Already have an account?{' '}
            <Link to="/talent/login" className="text-red font-bold hover:underline">Log in</Link>
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-8">
          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white border border-gray-200 rounded-[2rem] shadow-xl overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8">

              {emailConfirmPending && (
                <div className="p-5 bg-green-50 border border-green-200 text-green-900 rounded-2xl space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={20} className="shrink-0 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-black text-sm">Check your email to continue</p>
                      <p className="text-xs font-medium mt-1 text-green-800/80">
                        We saved your parsed profile. Confirm <strong>{form.email}</strong>, then log in to finish setup.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/talent/login"
                    className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-red hover:underline"
                  >
                    Go to Log In <ChevronRight size={12} />
                  </Link>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <span>{error}</span>
                    {/already registered/i.test(error) && (
                      <p className="mt-2">
                        <Link to="/talent/login" className="font-black underline">Log in here</Link>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* File Uploads */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* CV Upload */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-[10px]">1</div>
                    <h3 className="font-black text-xs tracking-widest uppercase">Upload CV <span className="text-red">*</span></h3>
                  </div>
                  {!cvFile ? (
                    <label className="flex flex-col items-center justify-center min-h-[180px] border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-red hover:bg-gray-50 transition-all cursor-pointer group">
                      <UploadCloud size={32} className="text-gray-400 mb-2 group-hover:text-red transition-colors" />
                      <p className="font-black text-xs text-gray-700 mb-1">Drop your CV here</p>
                      <p className="text-[10px] text-gray-400">PDF, PNG, JPG (max 5MB)</p>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleCV} className="hidden" />
                    </label>
                  ) : (
                    <div className="min-h-[180px] border border-green-200 bg-green-50/40 rounded-2xl p-5 flex flex-col justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl border border-green-200 flex items-center justify-center text-green-600 shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-green-800 text-xs truncate">{cvFile.name}</p>
                          <p className="text-[10px] text-green-600">{(cvFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button type="button" onClick={() => setCvFile(null)} className="ml-auto w-6 h-6 flex items-center justify-center bg-white border border-green-200 rounded-lg text-gray-400 hover:text-red transition-colors">
                          <X size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-green-700 text-[9px] font-black uppercase tracking-wider border-t border-green-200 pt-3 mt-3">
                        <CheckCircle2 size={11} className="text-green-500" />
                        CV ready for AI parsing
                      </div>
                    </div>
                  )}
                </div>

                {/* Photo Upload */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-[10px]">2</div>
                    <h3 className="font-black text-xs tracking-widest uppercase">Profile Photo <span className="text-red">*</span></h3>
                  </div>
                  {!photoPreview && !photoProcessing ? (
                    <label className="flex flex-col items-center justify-center min-h-[180px] border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-red hover:bg-gray-50 transition-all cursor-pointer group">
                      <Camera size={32} className="text-gray-400 mb-2 group-hover:text-red transition-colors" />
                      <p className="font-black text-xs text-gray-700 mb-1">Upload headshot</p>
                      <p className="text-[10px] text-gray-400 max-w-[220px]">JPG or PNG headshot — plain wall behind you works best</p>
                      <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                    </label>
                  ) : photoProcessing ? (
                    <div className="min-h-[180px] border border-gray-200 bg-gray-50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-10 h-10 border-4 border-red/20 border-t-red rounded-full animate-spin" />
                      <p className="font-black text-xs text-gray-700 uppercase tracking-wider">Formatting photo…</p>
                      <p className="text-[10px] text-gray-500 font-medium">Cropping to passport size</p>
                    </div>
                  ) : (
                    <div className="min-h-[180px] border border-green-200 bg-green-50/40 rounded-2xl p-5 flex flex-col justify-between items-center text-center">
                      <div className="relative">
                        <img src={photoPreview} alt="Preview" className="w-24 h-28 rounded-2xl object-cover object-top border-2 border-green-500 shadow-md" />
                        <button type="button" onClick={clearPhoto}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-green-200 rounded-full flex items-center justify-center text-gray-400 hover:text-red transition-colors">
                          <X size={11} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-green-700 text-[9px] font-black uppercase tracking-wider border-t border-green-200 pt-3 mt-3 w-full justify-center">
                        <CheckCircle2 size={11} className="text-green-500" />
                        Passport photo ready
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Details */}
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-[10px]">3</div>
                  <h3 className="font-black text-xs tracking-widest uppercase">Your Details</h3>
                </div>

                <div className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <User size={10} /> Full Name <span className="text-red">*</span>
                    </label>
                    <input type="text" name="name" value={form.name} onChange={handleInput}
                      placeholder="Maria Silva"
                      className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all placeholder:text-gray-400"
                      required />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Mail size={10} /> Email Address <span className="text-red">*</span>
                    </label>
                    <input type="email" name="email" value={form.email} onChange={handleInput}
                      placeholder="maria@example.com"
                      className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all placeholder:text-gray-400"
                      required />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Lock size={10} /> Password <span className="text-red">*</span>
                    </label>
                    <input type="password" name="password" value={form.password} onChange={handleInput}
                      placeholder="Min. 6 characters"
                      className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 focus:border-red focus:bg-white outline-none transition-all placeholder:text-gray-400"
                      required />
                  </div>
                </div>
              </div>

              {/* AI badge */}
              <div className="flex items-center gap-3 bg-black/5 border border-black/10 rounded-2xl p-4">
                <Sparkles size={18} className="text-red shrink-0" />
                <p className="text-[11px] text-gray-600 font-bold leading-snug">
                  Your CV will be read and it will extract your best title, skills, and bio. You'll review everything before publishing.
                </p>
              </div>

              {/* User Agreement Checkbox */}
              <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <input
                  type="checkbox"
                  id="agreementChecked"
                  checked={agreementChecked}
                  onChange={(e) => setAgreementChecked(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-gray-300 text-red focus:ring-red accent-red shrink-0 cursor-pointer"
                  required
                />
                <label htmlFor="agreementChecked" className="text-xs text-gray-600 font-bold leading-normal select-none cursor-pointer">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowAgreementModal(true)}
                    className="text-red hover:underline focus:outline-none inline-block font-black"
                  >
                    Candidate Talent Pool Agreement.
                  </button>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={emailConfirmPending || isLoading || photoProcessing || !form.name || !form.email || !form.password || !cvFile || !photoFile || !agreementChecked}
                className={`w-full py-4 rounded-2xl font-black text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-all border-2 ${!isLoading && !photoProcessing && form.name && form.email && form.password && cvFile && photoFile && agreementChecked
                  ? 'border-red text-red hover:bg-red hover:text-white shadow-xl shadow-red/10 cursor-pointer'
                  : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                  }`}
              >
                Submit and parse CV <ChevronRight size={14} />
              </button>
            </form>
          </motion.div>

          {/* How it works Sidebar */}
          <div className="space-y-4">
            <h3 className="font-black text-sm uppercase tracking-widest text-gray-800 px-2">How It Works</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-[2rem] p-6 space-y-6">
              {[
                { id: '01', title: 'DECLARE', desc: 'Upload your CV and let our AI build your profile. Edit and enhance it before publishing.' },
                { id: '02', title: 'DEMONSTRATE', desc: 'Complete a tailored, 25-min real-world client challenge.' },
                { id: '03', title: 'DEPLOY', desc: 'Qualified candidates are admitted to our pool and rank higher to the regional employers.' }
              ].map((step, idx) => (
                <div key={idx} className="relative pl-8">
                  <div className="absolute left-0 top-0 font-mono text-[9px] font-black text-red">
                    {step.id}
                  </div>
                  <h4 className="text-sm font-black uppercase text-black mb-1">{step.title}</h4>
                  <p className="text-xs font-medium text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Agreement Modal */}
      <AnimatePresence>
        {showAgreementModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowAgreementModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-black text-white p-6 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red rounded-full blur-[80px] opacity-25 -mr-10 -mt-10 pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <span className="text-red font-black text-[9px] uppercase tracking-[0.15em] block mb-1">Legal Agreement</span>
                    <h3 className="text-lg font-black uppercase tracking-tight">Candidate Talent Pool Agreement</h3>
                  </div>
                  <button onClick={() => setShowAgreementModal(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto space-y-5 text-sm text-gray-600 leading-relaxed font-medium">
                <div className="space-y-4">
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">1. Purpose</p><p>The purpose of this Agreement is to govern the Candidate's participation in the BYG Hires Talent Pool and the use, processing, and sharing of the Candidate's information for recruitment and staffing opportunities.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">2. Talent Pool Registration</p><p><strong>2.1</strong> The Candidate agrees to join the BYG Hires Talent Pool for consideration in remote employment, freelance, contractual, or recruitment opportunities.</p><p><strong>2.2</strong> Registration does not create an employment relationship between BYG Hires and the Candidate.</p><p><strong>2.3</strong> BYG Hires does not guarantee placement, interviews, employment offers, or minimum opportunities.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">3. Collection of Information</p><p><strong>3.1</strong> The Candidate authorizes BYG Hires to collect, process, store, and maintain personal and professional information, including but not limited to: full name and contact information, Resume/CV, employment history, educational qualifications, portfolio or work samples, interview feedback and assessments, and identification or verification documents where required.</p><p><strong>3.2</strong> The Candidate confirms that all submitted information is accurate, complete, and lawful.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">4. Use of Information</p><p><strong>4.1</strong> BYG Hires may use the Candidate's information for: recruitment and staffing purposes; candidate evaluation and verification; matching Candidates with potential employers or clients; scheduling interviews and communications; future employment opportunities and database management.</p><p><strong>4.2</strong> The Candidate authorizes BYG Hires to share relevant information with prospective employers or clients strictly for hiring-related purposes.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">5. Data Privacy & Protection</p><p><strong>5.1</strong> BYG Hires shall implement commercially reasonable measures to protect Candidate information against unauthorized access, disclosure, misuse, or loss.</p><p><strong>5.2</strong> BYG Hires shall process Candidate data in accordance with applicable GCC data protection principles, including the UAE Personal Data Protection Law (PDPL), where applicable.</p><p><strong>5.3</strong> BYG Hires shall not sell Candidate's personal information to unrelated third parties.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">6. Candidate Obligations</p><p>The Candidate agrees that: all information provided is truthful and up to date; submitted materials do not violate confidentiality obligations owed to third parties; the Candidate shall conduct themselves professionally during recruitment processes; and the Candidate shall not misuse confidential information received during interviews or assessments.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">7. Confidentiality</p><p><strong>7.1</strong> Any documents, assessments, interview materials, employer information, platform systems, or recruitment processes shared by BYG Hires shall remain confidential.</p><p><strong>7.2</strong> The Candidate shall not reproduce, distribute, disclose, or misuse confidential information without prior written consent.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">8. Intellectual Property</p><p>All website content, branding, systems, databases, templates, recruitment materials, and platform intellectual property remain the exclusive property of BYG Hires unless otherwise stated.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">9. No Employment Relationship</p><p><strong>9.1</strong> BYG Hires acts solely as a staffing and recruitment intermediary.</p><p><strong>9.2</strong> Nothing in this Agreement shall be interpreted as creating an employer-employee relationship, partnership, or agency relationship between BYG Hires and the Candidate.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">10. Limitation of Liability</p><p><strong>10.1</strong> BYG Hires shall not be liable for: hiring decisions made by clients; rejection of applications; employment termination by clients; candidate compensation disputes; or indirect, consequential, or business losses arising from platform use.</p><p><strong>10.2</strong> Candidates engage with prospective employers at their own discretion and responsibility.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">11. Termination & Withdrawal</p><p><strong>11.1</strong> The Candidate may request removal from the Talent Pool at any time by written request.</p><p><strong>11.2</strong> BYG Hires reserves the right to suspend, restrict, or terminate Candidate access for: fraudulent activity, misrepresentation, unprofessional conduct, violation of this Agreement, or unlawful activities.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">12. Governing Law & Jurisdiction</p><p><strong>12.1</strong> This Agreement shall be governed by and construed in accordance with the laws of the United Arab Emirates.</p><p><strong>12.2</strong> The Parties shall first attempt to resolve disputes through good faith negotiations.</p><p><strong>12.3</strong> Any unresolved dispute shall be subject to arbitration under the rules of the Dubai International Arbitration Centre (DIAC), with the seat of arbitration in Dubai, UAE.</p></div>
                  <div className="space-y-1.5"><p className="font-black text-xs text-black uppercase tracking-wider">13. Acceptance</p><p>By selecting the acceptance checkbox on the BYG Hires platform, the Candidate confirms that they have read, understood, and agreed to the terms of this Agreement.</p></div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                <button type="button" onClick={() => { setAgreementChecked(true); setShowAgreementModal(false); }} className="px-6 py-3 bg-black hover:bg-red text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm">Accept Terms</button>
                <button type="button" onClick={() => setShowAgreementModal(false)} className="px-6 py-3 bg-white border border-gray-200 text-gray-500 hover:text-black text-[10px] font-black uppercase tracking-wider rounded-xl transition-all">Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TalentSignupPage;
