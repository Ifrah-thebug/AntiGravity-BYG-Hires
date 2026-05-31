// src/pages/TalentApplyPage.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, UploadCloud, FileText, X, AlertTriangle, CheckCircle2, User, Mail, Phone, Briefcase, Star, Sparkles, ShieldCheck, Calendar, ArrowRight, Camera
} from 'lucide-react';
import { talentService } from '../services/talentService';
import { stylizeProfilePhoto } from '../services/geminiPhotoService';

// Fallback initial generator when no photo is uploaded
const Avatar = ({ name, size = 96 }) => {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1) * 17) % 360;
  return (
    <div
      className="rounded-3xl flex items-center justify-center text-white font-black shadow-xl"
      style={{
        width: size, height: size,
        fontSize: size * 0.35,
        background: `linear-gradient(135deg, hsl(${hue},55%,42%), hsl(${hue + 40},60%,32%))`,
      }}
    >
      {initials}
    </div>
  );
};

const TalentApplyPage = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    photo: '',
    password: ''
  });
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoProcessing, setPhotoProcessing] = useState(false); // Gemini stylization in progress
  
  // Country code & phone states
  const [countryCode, setCountryCode] = useState('+971');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Inline editing states for title, skills, etc
  const [editTitle, setEditTitle] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editYearsExp, setEditYearsExp] = useState(3);
  const [editRoleType, setEditRoleType] = useState('flexible');
  const [editFee, setEditFee] = useState(600);
  
  // API process states
  const [applyState, setApplyState] = useState('idle'); // 'idle' | 'parsing' | 'success'
  const [errorMsg, setErrorMsg] = useState('');
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  
  // Stores the resulting auto-created profile to show the success workspace
  const [registrationResult, setRegistrationResult] = useState(null);

  // Sync inline edit inputs when registrationResult is set/changed
  useEffect(() => {
    if (registrationResult) {
      setEditTitle(registrationResult.parsedResumeData?.detected_expertise || '');
      setEditSkills(registrationResult.parsedResumeData?.key_skills?.join(', ') || '');
      setEditYearsExp(registrationResult.parsedResumeData?.years_experience || 3);
      setEditRoleType(registrationResult.roleType || 'flexible');
      setEditFee(registrationResult.fee || 600);
    }
  }, [registrationResult]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Profile photo file selector — sends to Gemini for brand stylization
  const handlePhotoChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result;
        // Show original immediately as preview
        setPhotoPreview(rawBase64);
        setFormData(prev => ({ ...prev, photo: rawBase64 }));

        // Bypass Gemini for photo stylization to preserve original face,
        // and rely on brand-aligned CSS filtering on the frontend instead.
        setPhotoProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // CV selector handler (PDF or Image)
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMsg('');
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const removePhoto = () => {
    setPhotoPreview('');
    setFormData(prev => ({ ...prev, photo: '' }));
  };

  // Submit Application Form (CV parsing & auto-creation)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !phoneNumber || !formData.dob || !formData.photo || !selectedFile) {
      setErrorMsg("Please fill out all required fields, upload your profile photo, and upload your CV.");
      return;
    }

    setApplyState('parsing');
    setErrorMsg('');

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const fileBase64 = reader.result;
        
        try {
          const fullPhone = `${countryCode} ${phoneNumber.trim()}`;
          const result = await talentService.apply({
            ...formData,
            phone: fullPhone
          }, selectedFile, fileBase64);
          
          setApplyState('success');
          setRegistrationResult(result);
          
          // Store submission token locally
          localStorage.setItem('byg_last_submission_token', result.token);

          setTimeout(() => {
            setApplyState('idle');
          }, 2000);

        } catch (err) {
          setApplyState('idle');
          setErrorMsg(err.message || "Failed to parse CV and create profile.");
        }
      };
      reader.readAsDataURL(selectedFile);

    } catch (err) {
      setApplyState('idle');
      setErrorMsg(err.message || "Failed to parse CV and create profile.");
    }
  };

  return (
    <div className="bg-white text-black min-h-screen pt-32 pb-24 font-sans px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Visual AI Loader Overlay during submission */}
        <AnimatePresence>
          {(applyState === 'parsing' || applyState === 'success') && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-8 text-center"
            >
              {applyState === 'parsing' && (
                <div className="max-w-md flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-red/20 border-t-red rounded-full animate-spin mb-6" />
                  <h3 className="text-white font-black text-xl tracking-wider uppercase mb-2">Processing Your Profile</h3>
                  <p className="text-red font-black text-[10px] tracking-[0.25em] uppercase mb-4 animate-pulse">Extracting Credentials</p>
                  <p className="text-gray-400 text-xs font-mono">Reading CV nodes, matching department skillsets, and generating a premium bio template...</p>
                </div>
              )}

              {applyState === 'success' && (
                <motion.div 
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mb-6 shadow-xl shadow-green-500/20">
                    <CheckCircle2 size={36} />
                  </div>
                  <h3 className="text-white font-black text-2xl tracking-wider uppercase mb-2">Profile Auto-Created!</h3>
                  <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-6">Added to active talent pool</p>
                  <p className="text-gray-400 text-xs leading-normal max-w-xs">Building your dashboard. This will only take a moment...</p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── SUCCESS WORKSPACE (Profile Preview & Optional Assessment) ─────────── */}
        {registrationResult ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto space-y-12"
          >
            {/* Header Success Banner */}
            <div className="bg-black text-white p-8 md:p-12 rounded-[2.5rem] relative overflow-hidden border border-gray-800">
              <div className="absolute top-0 right-0 w-80 h-80 bg-red rounded-full blur-[140px] opacity-20 -mr-16 -mt-16" />
              <div className="relative z-10 space-y-4 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-black uppercase rounded-lg">
                  <CheckCircle2 size={12} /> Profile Created
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight uppercase leading-none text-white">
                  Welcome to the Pool, <span className="text-red">{registrationResult.name}</span>
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed max-w-2xl font-medium">
                  Your CV has been reviewed, your key strengths have been identified, and your profile card has been added to the Talent Pool.
                </p>
              </div>
            </div>

            {/* Main Action Split */}
            <div className="grid md:grid-cols-5 gap-8 items-start">
              {/* Profile Card Preview (Left 2 columns) */}
              <div className="md:col-span-2 space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Your Profile Card</p>
                  
                  <div className="group bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-lg flex flex-col">
                    {/* Photo container */}
                    <div className="relative w-full aspect-[4/5] overflow-hidden bg-gray-50">
                      {registrationResult.photo ? (
                        <img
                          src={registrationResult.photo}
                          alt={registrationResult.name}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white font-black text-5xl select-none"
                          style={{
                            background: `linear-gradient(135deg, hsl(${(registrationResult.name.charCodeAt(0) * 37 + (registrationResult.name.charCodeAt(1) || 0) * 17) % 360},55%,42%), hsl(${(registrationResult.name.charCodeAt(0) * 37 + (registrationResult.name.charCodeAt(1) || 0) * 17) % 360 + 40},60%,32%))`
                          }}
                        >
                          {registrationResult.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      {/* Unverified availability */}
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm border border-gray-100 text-black text-[9px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span>Available Now</span>
                      </div>

                      {/* Unverified Score Ring */}
                      <div className="absolute top-3 right-3 bg-gray-100 border border-gray-200 text-gray-600 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="text-red">N/A</span>
                        <span>score</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-4 flex flex-col gap-3 flex-1 text-left">
                      <div className="min-h-[56px] flex flex-col justify-start">
                        <p className="text-black font-black text-sm leading-tight">{registrationResult.name}</p>
                        <p className="text-gray-500 text-xs font-medium mt-0.5">{registrationResult.parsedResumeData?.detected_expertise || 'Remote Specialist'}</p>
                      </div>

                      <div className="min-h-[68px] flex flex-col gap-2.5 justify-center">
                        {/* Skills */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {registrationResult.parsedResumeData?.key_skills && registrationResult.parsedResumeData.key_skills.slice(0, 4).map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-gray-50 border border-gray-100 text-gray-600 font-bold text-[9px] uppercase tracking-wide rounded-lg">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold bg-gray-50 border border-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                            {registrationResult.parsedResumeData?.years_experience || 3} yrs experience
                          </span>
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
                            🔄 Flexible
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Monthly starting fee</p>
                          <p className="text-black font-black text-sm">
                            ${registrationResult.fee?.toLocaleString() || '600'}/mo
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit Profile Details Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6 space-y-4 text-left">
                  <h4 className="text-xs font-black text-black uppercase tracking-wider">Edit Profile Details</h4>
                  
                  <div className="space-y-3">
                    {/* Professional Title */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Professional Title</label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:border-red outline-none transition-all"
                        placeholder="e.g. Growth Marketing Specialist"
                      />
                    </div>

                    {/* Key Skills */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Key Skills (comma-separated)</label>
                      <input
                        type="text"
                        value={editSkills}
                        onChange={(e) => setEditSkills(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:border-red outline-none transition-all"
                        placeholder="e.g. Meta Ads, SEO, Analytics"
                      />
                    </div>

                    {/* Experience Years & Fee */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Experience (Years)</label>
                        <input
                          type="number"
                          min="0"
                          value={editYearsExp}
                          onChange={(e) => setEditYearsExp(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:border-red outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Monthly Fee ($)</label>
                        <input
                          type="number"
                          min="100"
                          value={editFee}
                          onChange={(e) => setEditFee(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:border-red outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Role Type */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Availability Preference</label>
                      <select
                        value={editRoleType}
                        onChange={(e) => setEditRoleType(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:border-red outline-none transition-all"
                      >
                        <option value="flexible">Flexible Timing</option>
                        <option value="night">Night Shift</option>
                        <option value="fulltime">9-5 Standard</option>
                        <option value="parttime">Part-Time</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!registrationResult) return;
                        const skillsArray = editSkills
                          .split(',')
                          .map(s => s.trim())
                          .filter(s => s.length > 0);
                        const updatedResult = {
                          ...registrationResult,
                          fee: editFee,
                          roleType: editRoleType,
                          parsedResumeData: {
                            ...registrationResult.parsedResumeData,
                            detected_expertise: editTitle,
                            key_skills: skillsArray,
                            years_experience: editYearsExp
                          }
                        };
                        talentService.saveSubmission(updatedResult);
                        setRegistrationResult(updatedResult);
                      }}
                      className="w-full py-2.5 bg-black hover:bg-red text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md"
                    >
                      Save Profile Changes
                    </button>
                  </div>
                </div>
              </div>

              {/* Assessment Boost (Right 3 columns) */}
              <div className="md:col-span-3 space-y-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Become A Top Talent</p>
                
                <div className="bg-white border border-gray-200 rounded-[2rem] p-8 shadow-sm space-y-6">
                  <div className="w-12 h-12 bg-red/10 text-red rounded-2xl flex items-center justify-center">
                    <Sparkles size={24} />
                  </div>
                  
                  <div className="space-y-2 text-left">
                    <h3 className="text-2xl font-black text-black uppercase tracking-tight">Become A Top Talent</h3>
                    <p className="text-gray-500 text-sm leading-relaxed font-medium">
                      Tell us what you are great at, take an assessment and prove your skill.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => navigate(`/assessment?token=${registrationResult.token}`)}
                      className="flex-1 py-4 px-6 bg-red hover:bg-black text-white font-black text-sm uppercase tracking-wide rounded-xl transition-all text-center flex items-center justify-center gap-2 shadow-lg"
                    >
                      Start Skill Assessment <ArrowRight size={14} />
                    </button>
                    <button
                      onClick={() => navigate('/talent')}
                      className="px-6 py-4 bg-white border border-gray-200 hover:border-black text-gray-700 hover:text-black font-black text-sm uppercase tracking-wide rounded-xl transition-colors"
                    >
                      Go to Browse Talent
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ─── REGULAR INTAKE APPLICATION FORM ─────────────────────────────── */
          <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-[2.5rem] shadow-xl overflow-hidden">
            <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8">
              
              {errorMsg && (
                <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-center gap-3 text-sm font-semibold">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Step 1: Uploads Section */}
              <div className="grid md:grid-cols-2 gap-8 text-left">
                {/* 1A: CV Uploader */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">1A</div>
                    <h3 className="font-black text-sm tracking-widest uppercase">UPLOAD YOUR CV <span className="text-red-500">*</span></h3>
                  </div>

                  {!selectedFile ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:bg-gray-50 hover:border-red transition-all cursor-pointer group relative min-h-[220px] flex flex-col justify-center items-center">
                      <input 
                        type="file" 
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        required
                      />
                      <UploadCloud className="text-gray-400 mb-2 group-hover:text-red transition-colors" size={36} />
                      <p className="font-black text-xs text-gray-700 mb-1">Drag & drop your CV</p>
                      <p className="text-[10px] text-gray-500">PDF, PNG, JPG (max 5MB)</p>
                    </div>
                  ) : (
                    <div className="border border-green-200 bg-green-50/30 rounded-2xl p-5 min-h-[220px] flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-green-200 shadow-sm text-green-600 shrink-0">
                            <FileText size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-green-800 text-xs uppercase tracking-wider mb-0.5 truncate">{selectedFile.name}</p>
                            <p className="text-[10px] text-green-700 font-bold">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Uploaded</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={removeFile}
                          className="w-6 h-6 bg-white hover:bg-red/10 border border-green-200 hover:border-red/20 text-gray-400 hover:text-red rounded-md flex items-center justify-center transition-colors shrink-0"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-green-700 font-black text-[9px] tracking-wider uppercase border-t border-green-200/50 pt-3">
                        <CheckCircle2 size={12} className="text-green-500" />
                        <span>CV Locked & Ready for parsing</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 1B: Profile Photo Uploader */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">1B</div>
                    <h3 className="font-black text-sm tracking-widest uppercase">PROFILE PHOTO <span className="text-red-500">*</span></h3>
                  </div>

                  {!photoPreview ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:bg-gray-50 hover:border-red transition-all cursor-pointer group relative min-h-[220px] flex flex-col justify-center items-center">
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        required
                      />
                      <Camera className="text-gray-400 mb-2 group-hover:text-red transition-colors" size={36} />
                      <p className="font-black text-xs text-gray-700 mb-1">Upload headshot photo</p>
                      <p className="text-[10px] text-gray-500">JPG, PNG (square ratio preferred)</p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 bg-gray-50 rounded-2xl p-5 min-h-[220px] flex flex-col justify-between items-center">
                      <div className="relative">
                        <img 
                          src={photoPreview} 
                          alt="Photo Preview" 
                          className={`w-20 h-20 rounded-full object-cover border-2 shadow-md transition-all duration-300 ${photoProcessing ? 'opacity-50 blur-sm border-gray-300' : 'opacity-100 border-red'}`}
                        />
                        {photoProcessing && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-red/30 border-t-red rounded-full animate-spin" />
                          </div>
                        )}
                        {!photoProcessing && (
                          <button 
                            type="button"
                            onClick={removePhoto}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-white hover:bg-red/10 border border-gray-200 text-gray-500 hover:text-red rounded-full flex items-center justify-center transition-colors"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      {photoProcessing ? (
                        <div className="text-center mt-2 space-y-1">
                          <p className="text-[10px] font-black text-red uppercase tracking-widest animate-pulse">Styling Photo...</p>
                          <p className="text-[9px] text-gray-400 font-medium">Applying brand aesthetic</p>
                        </div>
                      ) : (
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Headshot loaded</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Details Section */}
              <div className="space-y-6 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">2</div>
                  <h3 className="font-black text-sm tracking-widest uppercase">BASIC DETAILS</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                      <User size={12} className="text-gray-400" />
                      <span>FULL NAME <span className="text-red-500">*</span></span>
                    </label>
                    <input 
                      type="text" 
                      name="name"
                      placeholder="Maria Silva"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-red focus:bg-white outline-none transition-all font-bold text-base placeholder:text-gray-400"
                      required
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Mail size={12} className="text-gray-400" />
                      <span>EMAIL ADDRESS <span className="text-red-500">*</span></span>
                    </label>
                    <input 
                      type="email" 
                      name="email"
                      placeholder="maria@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-red focus:bg-white outline-none transition-all font-bold text-base placeholder:text-gray-400"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                      <User size={12} className="text-gray-400" />
                      <span>CREATE PASSWORD <span className="text-red-500">*</span></span>
                    </label>
                    <input 
                      type="password" 
                      name="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-red focus:bg-white outline-none transition-all font-bold text-base placeholder:text-gray-400"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 items-start">
                  {/* Phone */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Phone size={12} className="text-gray-400" />
                      <span>PHONE NUMBER <span className="text-red-500">*</span></span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        list="country-codes"
                        name="countryCode"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        placeholder="+971"
                        className="w-28 shrink-0 px-3 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-red focus:bg-white outline-none transition-all font-bold text-sm text-gray-800"
                        required
                      />
                      <datalist id="country-codes">
                        <option value="+971">🇦🇪 UAE</option>
                        <option value="+966">🇸🇦 KSA</option>
                        <option value="+965">🇰🇼 Kuwait</option>
                        <option value="+974">🇶🇦 Qatar</option>
                        <option value="+973">🇧🇭 Bahrain</option>
                        <option value="+968">🇴🇲 Oman</option>
                        <option value="+20">🇪🇬 Egypt</option>
                        <option value="+962">🇯🇴 Jordan</option>
                        <option value="+92">🇵🇰 Pakistan</option>
                        <option value="+91">🇮🇳 India</option>
                        <option value="+63">🇵🇭 Philippines</option>
                        <option value="+94">🇱🇰 Sri Lanka</option>
                        <option value="+880">🇧🇩 Bangladesh</option>
                        <option value="+1">🇺🇸 US/Canada</option>
                        <option value="+44">🇬🇧 UK</option>
                        <option value="+61">🇦🇺 Australia</option>
                        <option value="+27">🇿🇦 South Africa</option>
                      </datalist>
                      <input 
                        type="tel" 
                        name="phone"
                        placeholder="50 123 4567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="flex-1 min-w-0 px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-red focus:bg-white outline-none transition-all font-bold text-base placeholder:text-gray-400"
                        required
                      />
                    </div>
                  </div>

                  {/* DOB */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-400" />
                      <span>DATE OF BIRTH <span className="text-red-500">*</span></span>
                    </label>
                    <input 
                      type="date" 
                      name="dob"
                      value={formData.dob}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-red focus:bg-white outline-none transition-all font-bold text-base placeholder:text-gray-400 text-gray-700"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Checkbox for User Agreement */}
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
                    Candidate Talent Pool Agreement
                  </button>{' '}
                  and understand how my data will be handled.
                </label>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 border-t border-gray-100">
                {photoProcessing && (
                  <p className="text-[10px] font-black text-red uppercase tracking-widest text-center mb-3 animate-pulse">
                    ⏳ Styling your photo... please wait
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!formData.name || !formData.email || !phoneNumber || !formData.dob || !formData.photo || !selectedFile || !agreementChecked || photoProcessing}
                  className={`w-full py-5 rounded-2xl font-black text-xs tracking-[0.2em] transition-all uppercase border-2 flex items-center justify-center gap-2 ${
                    formData.name && formData.email && phoneNumber && formData.dob && formData.photo && selectedFile && agreementChecked && !photoProcessing
                      ? 'border-red text-red hover:bg-red hover:text-white cursor-pointer shadow-xl shadow-red/10'
                      : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                  }`}
                >
                  <span>{photoProcessing ? 'PROCESSING PHOTO...' : 'SUBMIT APPLICATION & CREATE PROFILE'}</span>
                  <ChevronRight size={14} />
                </button>
              </div>

            </form>
          </div>
        )}

      </div>

      {/* User Agreement Modal */}
      <AnimatePresence>
        {showAgreementModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
              {/* Modal Header */}
              <div className="bg-black text-white p-6 relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red rounded-full blur-[80px] opacity-25 -mr-10 -mt-10 pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <span className="text-red font-black text-[9px] uppercase tracking-[0.15em] block mb-1">Agreement Workspace</span>
                    <h3 className="text-lg font-black uppercase tracking-tight">Candidate Talent Pool Agreement</h3>
                  </div>
                  <button 
                    onClick={() => setShowAgreementModal(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-600 leading-relaxed font-medium">
                <div>
                  <p className="font-bold text-gray-800 text-base mb-1 uppercase tracking-wide">CANDIDATE TALENT POOL AGREEMENT</p>
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">BYG Hires Staffing Services</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <p className="font-black text-xs text-black uppercase tracking-wider">1. PURPOSE</p>
                    <p>The purpose of this Agreement is to govern the Candidate’s participation in the BYG Hires Talent Pool and the use, processing, and sharing of the Candidate’s information for recruitment and staffing opportunities.</p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="font-black text-xs text-black uppercase tracking-wider">2. TALENT POOL REGISTRATION</p>
                    <p><strong>2.1</strong> The Candidate agrees to join the BYG Hires Talent Pool for consideration in remote employment, freelance, contractual, or recruitment opportunities presented by BYG Hires or its clients.</p>
                    <p><strong>2.2</strong> Registration in the Talent Pool does not create an employment relationship between BYG Hires and the Candidate.</p>
                    <p><strong>2.3</strong> BYG Hires does not guarantee placement, interviews, employment offers, or minimum opportunities.</p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="font-black text-xs text-black uppercase tracking-wider">3. COLLECTION OF INFORMATION</p>
                    <p><strong>3.1</strong> The Candidate authorizes BYG Hires to collect, process, store, and maintain personal and professional information, including but not limited to: personal details, headshot, CV, and assessments.</p>
                    <p><strong>3.2</strong> The Candidate confirms that all submitted information is accurate, complete, and lawful.</p>
                  </div>

                  <div className="space-y-1.5">
                    <p className="font-black text-xs text-black uppercase tracking-wider">4. USE OF INFORMATION</p>
                    <p><strong>4.1</strong> BYG Hires may use the Candidate’s information for recruitment and staffing, evaluation, matching, scheduling communications, and future opportunities.</p>
                    <p><strong>4.2</strong> The Candidate authorizes BYG Hires to share relevant information with prospective employers, clients, or affiliated recruitment partners strictly for hiring-related purposes.</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setAgreementChecked(true);
                    setShowAgreementModal(false);
                  }}
                  className="px-6 py-3 bg-black hover:bg-red text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
                >
                  Accept Terms
                </button>
                <button
                  type="button"
                  onClick={() => setShowAgreementModal(false)}
                  className="px-6 py-3 bg-white border border-gray-200 text-gray-500 hover:text-black text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TalentApplyPage;
