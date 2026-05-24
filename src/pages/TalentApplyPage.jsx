// src/pages/TalentApplyPage.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, UploadCloud, FileText, X, AlertTriangle, CheckCircle2, User, Mail, Phone, Briefcase, Star, Sparkles, ShieldCheck 
} from 'lucide-react';
import { talentService, standardScenarios } from '../services/talentService';

const TalentApplyPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    expertise: '',
    yearsExp: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  
  // API process states
  const [applyState, setApplyState] = useState('idle'); // 'idle' | 'uploading' | 'parsing' | 'success'
  const [parsedData, setParsedData] = useState(null);
  const [activePreviewRole, setActivePreviewRole] = useState('Operations');
  const [errorMsg, setErrorMsg] = useState('');

  // Update scenario preview matching dropdown selection
  useEffect(() => {
    if (formData.expertise && standardScenarios[formData.expertise]) {
      setActivePreviewRole(formData.expertise);
    }
  }, [formData.expertise]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Mock File Selector handler
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      triggerResumeVisionParse(file);
    }
  };

  // Trigger Gemini vision parser simulation
  const triggerResumeVisionParse = async (file) => {
    setApplyState('parsing');
    setErrorMsg('');
    try {
      // Create simulated form data to trigger parse service
      const tempFormData = {
        name: formData.name || 'Candidate Name',
        expertise: formData.expertise || 'Operations',
        yearsExp: formData.yearsExp || 'mid'
      };

      // Call simulated Gemini service
      const response = await talentService.apply(tempFormData, file);
      setParsedData(response.parsedResumeData);
      
      // Auto-prefill form fields based on parsed values
      setFormData(prev => ({
        ...prev,
        expertise: response.expertise,
        yearsExp: response.yearsExp
      }));
      setApplyState('idle');
    } catch (err) {
      setApplyState('idle');
      setErrorMsg(err.message || 'Parsing failed. Please check files.');
    }
  };

  // Skip resume parse
  const handleSkipParse = () => {
    setSelectedFile({ name: 'Manual_Selection_Resume.pdf', size: 1048576 });
    setParsedData({
      detected_expertise: formData.expertise || "Operations Manager",
      years_experience: formData.yearsExp === 'senior' ? 9 : formData.yearsExp === 'junior' ? 2 : 5,
      prior_roles: ["Expert Consultant"],
      key_skills: ["Communication", "Strategy"],
      red_flags: null,
      expertise_mismatch: false,
      notes: "Manually filled credentials. No mismatches flagged."
    });
  };

  const removeFile = () => {
    setSelectedFile(null);
    setParsedData(null);
  };

  // Submit Application Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.expertise || !formData.yearsExp) {
      setErrorMsg("Please fill out all required fields.");
      return;
    }

    setApplyState('uploading');
    setErrorMsg('');

    try {
      // Call service layer to submit the application
      const result = await talentService.apply(formData, selectedFile);
      
      setApplyState('success');
      // Store submission token locally for the redirection check
      localStorage.setItem('byg_last_submission_token', result.token);

      setTimeout(() => {
        navigate(`/status?token=${result.token}`);
      }, 2500);

    } catch (err) {
      setApplyState('idle');
      setErrorMsg(err.message || "Failed to submit application.");
    }
  };

  const previewScenario = standardScenarios[activePreviewRole] || standardScenarios['Operations'];

  return (
    <div className="bg-white text-black min-h-screen pt-32 pb-24 font-sans px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Breadcrumb / Title */}
        <div className="text-center mb-16">
          <p className="text-red font-black tracking-[0.2em] text-[10px] mb-4 uppercase">APPLICATION WORKSPACE</p>
          <h1 className="text-4xl md:text-6xl font-black text-black tracking-tight uppercase leading-none">
            Ready to bypass the resume pile?
          </h1>
          <p className="text-gray-500 font-medium mt-4 text-base md:text-lg max-w-xl mx-auto">
            Provide your contact details, upload your CV, and start a real-world task assessment.
          </p>
        </div>

        <div className="grid xl:grid-cols-5 gap-12 items-start">
          
          {/* LEFT PANEL: Intake Form & File Upload (Colspan 3) */}
          <div className="xl:col-span-3 bg-white border border-gray-200 rounded-[2.5rem] shadow-xl overflow-hidden relative">
            
            {/* Visual AI Loader Overlay */}
            <AnimatePresence>
              {(applyState === 'parsing' || applyState === 'uploading' || applyState === 'success') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-8 text-center"
                >
                  {applyState === 'parsing' && (
                    <>
                      <div className="w-16 h-16 border-4 border-red/20 border-t-red rounded-full animate-spin mb-6" />
                      <h3 className="text-white font-black text-xl tracking-wider uppercase mb-2">Gemini Vision API Active</h3>
                      <p className="text-gray-400 text-xs font-mono max-w-sm">Reading resume nodes, extracting prior job titles, and analyzing skills alignment...</p>
                    </>
                  )}

                  {applyState === 'uploading' && (
                    <>
                      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-6" />
                      <h3 className="text-white font-black text-xl tracking-wider uppercase mb-2">Mirroring to Google Drive</h3>
                      <p className="text-gray-400 text-xs font-mono max-w-sm">Creating drive folder, writing raw PDF payload, and initializing assessment link...</p>
                    </>
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
                      <h3 className="text-white font-black text-2xl tracking-wider uppercase mb-2">APPLICATION LOCKED!</h3>
                      <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-6">Assessment generated dynamically</p>
                      <p className="text-gray-400 text-xs leading-normal max-w-xs">An assessment invite has been sent. Opening status check in a moment...</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-8">
              
              {/* Error messages */}
              {errorMsg && (
                <div className="p-4 bg-red/5 border border-red/20 text-red rounded-2xl flex items-center gap-3 text-sm font-semibold">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Step 1: Resume Upload */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">1A</div>
                  <h3 className="font-black text-lg tracking-widest uppercase">UPLOAD YOUR RESUME</h3>
                </div>

                {!selectedFile ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center hover:bg-gray-50 hover:border-red transition-all cursor-pointer group relative">
                    <input 
                      type="file" 
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="mx-auto text-gray-400 mb-4 group-hover:text-red transition-colors" size={48} />
                    <p className="font-bold text-gray-700 mb-1">Drag & drop your resume or click to upload</p>
                    <p className="text-xs text-gray-500 mb-6">Accepted: PDF, DOC, DOCX (max 5MB)</p>
                    <button 
                      type="button"
                      onClick={handleSkipParse}
                      className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-gray-200 transition-colors z-10"
                    >
                      Skip — Select manually
                    </button>
                  </div>
                ) : (
                  <div className="border border-green-200 bg-green-50/50 rounded-2xl p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-green-200 shadow-sm text-green-600 shrink-0">
                          <FileText size={24} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-green-800 text-sm uppercase tracking-wider mb-1 truncate">{selectedFile.name}</p>
                          <p className="text-xs text-green-700 font-bold">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • File verified</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={removeFile}
                        className="w-7 h-7 bg-white hover:bg-red/10 border border-green-200 hover:border-red/20 text-gray-400 hover:text-red rounded-lg flex items-center justify-center transition-colors shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {parsedData && (
                      <div className="mt-6 pt-5 border-t border-green-200/50 space-y-4">
                        <div className="flex items-center gap-2 text-green-800 font-black text-[10px] tracking-wider uppercase">
                          <ShieldCheck size={14} />
                          <span>Gemini Parser Results</span>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-gray-400 font-bold mb-1 uppercase tracking-widest text-[9px]">DETECTED ROLE</p>
                            <p className="font-bold text-gray-800">{parsedData.detected_expertise}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-bold mb-1 uppercase tracking-widest text-[9px]">EXPERIENCE YEAR</p>
                            <p className="font-bold text-gray-800">{parsedData.years_experience} Years</p>
                          </div>
                        </div>

                        {/* Mismatch Alert Box */}
                        {parsedData.expertise_mismatch && (
                          <div className="p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl text-xs space-y-1">
                            <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                              <AlertTriangle size={14} className="text-yellow-600" />
                              <span>Role Mismatch Detected</span>
                            </div>
                            <p className="leading-relaxed font-medium">{parsedData.notes}</p>
                          </div>
                        )}

                        <div>
                          <p className="text-gray-400 font-bold mb-2 uppercase tracking-widest text-[9px]">PARSED SKILLS</p>
                          <div className="flex flex-wrap gap-1.5">
                            {parsedData.key_skills.map((s, idx) => (
                              <span key={idx} className="px-2.5 py-1 bg-green-100 border border-green-200 text-green-800 font-bold text-[10px] rounded-lg uppercase">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Contact Form */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">1B</div>
                  <h3 className="font-black text-lg tracking-widest uppercase">PERSONAL DETAILS</h3>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                      <User size={12} className="text-gray-400" />
                      <span>FULL NAME</span>
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
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Mail size={12} className="text-gray-400" />
                      <span>EMAIL ADDRESS</span>
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
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Phone size={12} className="text-gray-400" />
                      <span>PHONE NUMBER</span>
                    </label>
                    <input 
                      type="tel" 
                      name="phone"
                      placeholder="+971 50 123 4567"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-red focus:bg-white outline-none transition-all font-bold text-base placeholder:text-gray-400"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Briefcase size={12} className="text-gray-400" />
                      <span>PRIMARY EXPERTISE</span>
                    </label>
                    <div className="relative">
                      <select 
                        name="expertise"
                        value={formData.expertise}
                        onChange={handleInputChange}
                        className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-red focus:bg-white outline-none transition-all font-bold text-base appearance-none cursor-pointer text-gray-800"
                        required
                      >
                        <option value="" disabled>Select role...</option>
                        <option value="Operations">Operations</option>
                        <option value="Customer Success">Customer Success</option>
                        <option value="Marketing">Marketing</option>
                        <option value="EA">Executive Assistant (EA)</option>
                        <option value="Data">Data & Analytics</option>
                        <option value="Finance">Finance</option>
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <ChevronRight size={16} className="rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Star size={12} className="text-gray-400" />
                    <span>YEARS OF EXPERIENCE</span>
                  </label>
                  <div className="relative">
                    <select 
                      name="yearsExp"
                      value={formData.yearsExp}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-red focus:bg-white outline-none transition-all font-bold text-base appearance-none cursor-pointer text-gray-800"
                      required
                    >
                      <option value="" disabled>Select years...</option>
                      <option value="junior">1-2 Years</option>
                      <option value="mid">3-5 Years</option>
                      <option value="senior">6-10 Years</option>
                      <option value="lead">10+ Years</option>
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <ChevronRight size={16} className="rotate-90" />
                    </div>
                  </div>
                </div>

              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={!formData.name || !formData.email || !formData.expertise || !formData.yearsExp}
                  className={`w-full py-5 rounded-2xl font-black text-xs tracking-[0.2em] transition-all uppercase border-2 flex items-center justify-center gap-2 ${
                    formData.name && formData.email && formData.expertise && formData.yearsExp
                      ? 'border-red text-red hover:bg-red hover:text-white cursor-pointer shadow-xl shadow-red/10'
                      : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                  }`}
                >
                  <span>SUBMIT APPLICATION & LOCK ASSESSMENT</span>
                  <ChevronRight size={14} />
                </button>
              </div>

            </form>
          </div>

          {/* RIGHT PANEL: Sleek Preview Assessment Tile (Colspan 2) */}
          <div className="xl:col-span-2 flex flex-col h-full sticky top-32 space-y-6">
            
            <div className="bg-[#0b0b0d] text-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl relative overflow-hidden flex-1 flex flex-col border border-gray-800">
              
              {/* Decorative background glow */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-red rounded-full blur-[80px] opacity-25 -mr-12 -mt-12 pointer-events-none" />

              <div className="flex items-center justify-between mb-8 relative z-10 border-b border-white/5 pb-4">
                <span className="text-[10px] font-black text-gray-500 tracking-widest uppercase">DYNAMIC SCENARIO PREVIEW</span>
              </div>

              <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="px-3.5 py-1.5 bg-red/10 border border-red/30 text-red text-[9px] font-black rounded-lg uppercase tracking-wider">
                  {previewScenario.time}
                </div>
                <div className="px-3.5 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-[9px] font-black rounded-lg uppercase tracking-wider">
                  {previewScenario.level} level
                </div>
              </div>

              <div className="relative z-10 flex-1 space-y-6">
                <div>
                  <h3 className="text-xl md:text-2xl font-black leading-snug mb-3 uppercase tracking-wide text-white">
                    {previewScenario.title}
                  </h3>
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-gray-400 text-xs md:text-sm leading-relaxed font-medium">
                    {previewScenario.desc}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-500 tracking-wider uppercase">Deliverables Required</p>
                  <div className="space-y-2.5">
                    {previewScenario.checklist.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl">
                        <div className="w-5 h-5 rounded-full bg-red/10 text-red flex items-center justify-center font-bold text-[10px] shrink-0">
                          {idx + 1}
                        </div>
                        <p className="text-xs text-gray-300 font-bold leading-normal">{c}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 relative z-10 flex items-center justify-center gap-2.5 text-gray-500 font-black text-[9px] tracking-wider uppercase">
                <CheckCircle2 size={14} className="text-green-500" />
                <span>Application Required To Start Task</span>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};

export default TalentApplyPage;
