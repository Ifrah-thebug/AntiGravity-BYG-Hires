// src/pages/TalentSignupPage.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import {
  UploadCloud, Camera, FileText, X, AlertTriangle,
  CheckCircle2, ChevronRight, Mail, Lock, User, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { parseCV } from '../lib/geminiCV';

const TalentSignupPage = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [cvFile, setCvFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState('idle'); // idle | uploading | parsing | done

  const handleInput = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleCV = (e) => {
    const f = e.target.files?.[0];
    if (f) { setCvFile(f); setError(''); }
  };

  const handlePhoto = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setPhotoFile(f);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(f);
    }
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

    try {
      // 1. Create Supabase auth user
      setStep('uploading');
      const { user } = await signUp(form.email, form.password);
      const userId = user?.id;
      if (!userId) throw new Error('Signup succeeded but no user ID returned. Check your email to confirm your account, then log in.');

      // 2. Upload CV to Supabase Storage
      const cvExt = cvFile.name.split('.').pop();
      const cvPath = `${userId}/cv.${cvExt}`;
      const { error: cvUpErr } = await supabase.storage
        .from('talent-files')
        .upload(cvPath, cvFile, { upsert: true });
      if (cvUpErr) throw new Error(`CV upload failed: ${cvUpErr.message}`);

      const { data: cvUrlData } = supabase.storage.from('talent-files').getPublicUrl(cvPath);
      const cvUrl = cvUrlData.publicUrl;

      // 3. Upload Photo to Supabase Storage
      const photoExt = photoFile.name.split('.').pop();
      const photoPath = `${userId}/photo.${photoExt}`;
      const { error: photoUpErr } = await supabase.storage
        .from('talent-files')
        .upload(photoPath, photoFile, { upsert: true });
      if (photoUpErr) throw new Error(`Photo upload failed: ${photoUpErr.message}`);

      const { data: photoUrlData } = supabase.storage.from('talent-files').getPublicUrl(photoPath);
      const photoUrl = photoUrlData.publicUrl;

      // 4. Parse CV with Gemini
      setStep('parsing');
      const reader = new FileReader();
      const cvParsed = await new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            const dataUrl = reader.result;
            const base64 = dataUrl.split(',')[1];
            const mime = cvFile.type || 'application/pdf';
            const result = await parseCV(base64, mime);
            resolve(result);
          } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(cvFile);
      });

      setStep('done');

      // 5. Navigate to setup page with all data
      navigate('/talent/setup', {
        state: {
          userId,
          name: form.name || cvParsed.name || '',
          email: form.email,
          cvUrl,
          photoUrl,
          parsed: cvParsed,
        },
      });
    } catch (err) {
      setStep('idle');
      setError(err.message || 'Something went wrong. Please try again.');
    }
  };

  const isLoading = step !== 'idle' && step !== 'done';

  return (
    <div className="bg-white min-h-screen pt-28 pb-24 px-4 font-sans">
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center text-center p-8"
          >
            <div className="w-16 h-16 border-4 border-red/20 border-t-red rounded-full animate-spin mb-6" />
            <h3 className="text-white font-black text-xl uppercase tracking-wider mb-2">
              {step === 'uploading' ? 'Uploading Your Files…' : 'Parsing Your CV with AI…'}
            </h3>
            <p className="text-gray-400 text-xs font-mono max-w-xs">
              {step === 'uploading'
                ? 'Securely storing your CV and photo in the talent files vault.'
                : 'Gemini is reading your CV and extracting your professional profile…'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-3">Prove your craft. Skip the queue.</p>
          <h1 className="text-4xl md:text-5xl font-black text-black tracking-tight leading-tight mb-4">
            Create your<br /><span className="text-red">profile.</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium max-w-lg mx-auto">
            No resume roulette. Complete a real-world task assessment, get scored, and make your profile stronger with your score.<br/><br/>
            Already have an account?{' '}
            <Link to="/talent/login" className="text-red font-bold hover:underline">Log in</Link>
          </p>
        </motion.div>

        {/* How It Works Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-12">
          <div className="bg-black text-white rounded-3xl p-8 shadow-xl">
            <p className="text-red font-black tracking-widest text-[10px] uppercase mb-1">The BYG Quality Gateway</p>
            <h2 className="text-2xl font-black uppercase tracking-tight mb-3">How It Works</h2>
            <p className="text-gray-400 text-xs font-medium mb-8 max-w-lg">
              We replace standard recruitment forms with highly optimized skill-assessments designed to showcase your talent in action.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="border-l border-gray-800 pl-4">
                <p className="text-[10px] text-gray-500 font-bold mb-1">01</p>
                <p className="text-xs font-black uppercase text-white mb-2">Step 1: Declare</p>
                <p className="text-[10px] text-gray-400 leading-relaxed mb-3">Select your primary role, upload your resume, and state your years of experience.</p>
                <p className="text-[9px] font-bold text-gray-600 bg-white/5 inline-block px-2 py-1 rounded">2 minutes</p>
              </div>
              <div className="border-l border-red pl-4">
                <p className="text-[10px] text-red font-bold mb-1">02</p>
                <p className="text-xs font-black uppercase text-white mb-2">Step 2: Demonstrate</p>
                <p className="text-[10px] text-gray-400 leading-relaxed mb-3">Complete a tailored, 25-minute real-world client challenge. Your output is your application.</p>
                <p className="text-[9px] font-bold text-red bg-red/10 inline-block px-2 py-1 rounded">20-30 minutes</p>
              </div>
              <div className="border-l border-gray-800 pl-4">
                <p className="text-[10px] text-gray-500 font-bold mb-1">03</p>
                <p className="text-xs font-black uppercase text-white mb-2">Step 3: Deploy</p>
                <p className="text-[10px] text-gray-400 leading-relaxed mb-3">Qualified candidates are admitted to our pool and instantly visible to regional employers.</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Form Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center mb-8">
          <h2 className="text-2xl font-black text-black tracking-tight">
            Join the Talent Pool
          </h2>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-[2rem] shadow-xl overflow-hidden"
        >
          <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-8">

            {error && (
              <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-start gap-3 text-sm font-semibold">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
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
                      <button type="button" onClick={() => setCvFile(null)} className="ml-auto w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-red transition-colors">
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
                {!photoPreview ? (
                  <label className="flex flex-col items-center justify-center min-h-[180px] border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-red hover:bg-gray-50 transition-all cursor-pointer group">
                    <Camera size={32} className="text-gray-400 mb-2 group-hover:text-red transition-colors" />
                    <p className="font-black text-xs text-gray-700 mb-1">Upload headshot</p>
                    <p className="text-[10px] text-gray-400">JPG, PNG (square preferred)</p>
                    <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
                  </label>
                ) : (
                  <div className="min-h-[180px] border border-gray-200 bg-gray-50 rounded-2xl p-5 flex flex-col items-center justify-center gap-3">
                    <div className="relative">
                      <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-2xl object-cover border-2 border-green-500 shadow-md" />
                      <button type="button" onClick={() => { setPhotoPreview(''); setPhotoFile(null); }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-red transition-colors">
                        <X size={11} />
                      </button>
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Photo ready</p>
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

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !form.name || !form.email || !form.password || !cvFile || !photoFile}
              className={`w-full py-4 rounded-2xl font-black text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 transition-all border-2 ${
                !isLoading && form.name && form.email && form.password && cvFile && photoFile
                  ? 'border-red text-red hover:bg-red hover:text-white shadow-xl shadow-red/10 cursor-pointer'
                  : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
              }`}
            >
              Submit and parse CV <ChevronRight size={14} />
            </button>
          </form>
        </motion.div>
        {/* Demo Assessment Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-12">
          <div className="bg-gray-50 border border-gray-200 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-black text-white flex items-center justify-center rounded-xl">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-red font-black tracking-widest text-[9px] uppercase">Example</p>
                <h3 className="text-lg font-black text-black">Sample Demo Assessment</h3>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Skill-First Assessment</p>
                  <p className="text-sm font-black text-black">Fulfillment & Operations Challenge</p>
                </div>
                <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-[10px] font-bold">25 min</div>
              </div>
              <p className="text-gray-600 text-sm font-medium italic mb-6">
                "A tour operator managing 40+ daily bookings has noticed a 30% no-show rate over the past 2 weeks... Identify the operational bottlenecks and draft an SOP recovery plan."
              </p>
              <div className="space-y-3">
                <div className="flex gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="w-6 h-6 bg-white border border-gray-200 rounded text-gray-500 flex flex-col items-center justify-center text-[10px] font-black shrink-0">1</div>
                  <p className="text-xs font-bold text-gray-700">Diagnose the root bottleneck in 3 sentences</p>
                </div>
                <div className="flex gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="w-6 h-6 bg-white border border-gray-200 rounded text-gray-500 flex flex-col items-center justify-center text-[10px] font-black shrink-0">2</div>
                  <p className="text-xs font-bold text-gray-700">Draft fleet coordination instructions</p>
                </div>
                <div className="flex gap-3 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="w-6 h-6 bg-white border border-gray-200 rounded text-gray-500 flex flex-col items-center justify-center text-[10px] font-black shrink-0">3</div>
                  <p className="text-xs font-bold text-gray-700">Outline permanent geo-fencing SOPs</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TalentSignupPage;
