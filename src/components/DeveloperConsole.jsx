// src/components/DeveloperConsole.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Database, HardDrive, Cpu, X, FileText, ChevronRight, RefreshCw, Trash2, Folder } from 'lucide-react';
import { talentService } from '../services/talentService';

const DeveloperConsole = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('prompts'); // 'prompts' | 'drive' | 'database'
  const [submissions, setSubmissions] = useState([]);
  const [driveTree, setDriveTree] = useState([]);
  
  const refreshData = () => {
    const subs = talentService.getSubmissions();
    setSubmissions(subs);

    // Build simulated Google Drive hierarchy
    const tree = [];
    subs.forEach(s => {
      if (s.driveFolder) {
        const files = s.driveFiles || [
          { path: `${s.driveFolder}/resume.pdf`, size: s.resumeFile?.size || 1048576, status: 'Uploaded' }
        ];
        tree.push({
          folder: s.driveFolder,
          talentName: s.name,
          files: files
        });
      }
    });
    setDriveTree(tree);
  };

  useEffect(() => {
    refreshData();
    
    // Listen to changes in storage to update console instantly
    window.addEventListener('storage', refreshData);
    const interval = setInterval(refreshData, 2000); // fallback polling

    return () => {
      window.removeEventListener('storage', refreshData);
      clearInterval(interval);
    };
  }, []);

  const clearDatabase = () => {
    if (window.confirm("Are you sure you want to reset the Talent Database to seeds?")) {
      localStorage.removeItem('byg_submissions');
      localStorage.removeItem('byg_email_outbox');
      localStorage.removeItem('byg_admin_session');
      refreshData();
      window.location.reload();
    }
  };

  // Get active or most recent candidate prompts
  const activeSub = submissions[0] || null;

  return (
    <>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-6 right-6 z-[100] flex gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-5 py-3.5 bg-black text-white hover:bg-red border-2 border-gray-800 hover:border-red rounded-full font-black text-xs uppercase tracking-widest shadow-2xl transition-all duration-300 group"
        >
          <Terminal size={16} className="text-red group-hover:text-white group-hover:rotate-12 transition-all" />
          <span>AI Developer Console</span>
          {submissions.filter(s => s.status === 'pending_human_review').length > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 h-[50vh] min-h-[400px] bg-[#0c0c0e] text-[#a9b2c3] border-t border-gray-800 shadow-[0_-20px_50px_rgba(0,0,0,0.6)] z-[99] flex flex-col font-mono text-xs select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#141416] border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Terminal size={18} className="text-red" />
                <span className="font-black tracking-wider text-white uppercase text-[10px]">BYG HIRES DEVELOPER CONSOLE & INTEGRATION SANDBOX</span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={refreshData}
                  className="p-1 hover:text-white transition-colors"
                  title="Force Refresh Data"
                >
                  <RefreshCw size={14} />
                </button>
                <button 
                  onClick={clearDatabase}
                  className="flex items-center gap-1.5 px-3 py-1 bg-red/10 border border-red/20 text-red hover:bg-red hover:text-white transition-all rounded"
                  title="Reset Sandbox"
                >
                  <Trash2 size={12} />
                  <span>RESET DATABASE</span>
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Body Split */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* Left Tabs */}
              <div className="w-48 bg-[#0e0e10] border-r border-gray-800 flex flex-col pt-4">
                <button
                  onClick={() => setActiveTab('prompts')}
                  className={`flex items-center gap-2.5 px-5 py-4 font-bold border-l-2 text-left transition-all ${
                    activeTab === 'prompts'
                      ? 'bg-white/5 border-red text-white'
                      : 'border-transparent hover:bg-white/2'
                  }`}
                >
                  <Cpu size={14} className={activeTab === 'prompts' ? 'text-red' : ''} />
                  <span>Gemini/Claude Prompts</span>
                </button>
                <button
                  onClick={() => setActiveTab('drive')}
                  className={`flex items-center gap-2.5 px-5 py-4 font-bold border-l-2 text-left transition-all ${
                    activeTab === 'drive'
                      ? 'bg-white/5 border-red text-white'
                      : 'border-transparent hover:bg-white/2'
                  }`}
                >
                  <HardDrive size={14} className={activeTab === 'drive' ? 'text-red' : ''} />
                  <span>Google Drive Folder</span>
                </button>
                <button
                  onClick={() => setActiveTab('database')}
                  className={`flex items-center gap-2.5 px-5 py-4 font-bold border-l-2 text-left transition-all ${
                    activeTab === 'database'
                      ? 'bg-white/5 border-red text-white'
                      : 'border-transparent hover:bg-white/2'
                  }`}
                >
                  <Database size={14} className={activeTab === 'database' ? 'text-red' : ''} />
                  <span>LocalStorage DB</span>
                </button>

                <div className="mt-auto p-4 border-t border-gray-900 bg-[#070708] text-[9px] text-gray-500 leading-normal">
                  <p className="font-bold text-gray-400 mb-1">MVP STATS:</p>
                  <p>Candidates: {submissions.length}</p>
                  <p>Admitted: {submissions.filter(s => s.status === 'admitted').length}</p>
                  <p>Reviewing: {submissions.filter(s => s.status === 'pending_human_review').length}</p>
                </div>
              </div>

              {/* Right content window */}
              <div className="flex-1 overflow-auto bg-[#0a0a0c] p-6 text-gray-300">
                
                {/* 1. PROMPTS TAB */}
                {activeTab === 'prompts' && (
                  <div className="space-y-6">
                    <h3 className="text-white font-bold text-sm border-b border-gray-800 pb-2 flex items-center justify-between">
                      <span>Gemini / Claude Pipeline Visualizer</span>
                      {activeSub ? (
                        <span className="text-xs text-red font-medium">Viewing logs for: {activeSub.name}</span>
                      ) : (
                        <span className="text-xs text-gray-500 font-medium">No candidates yet. Apply to generate logs.</span>
                      )}
                    </h3>

                    {!activeSub ? (
                      <p className="text-gray-500 py-8 text-center">No active AI logging details are available. Please submit an application at <a href="/talent-pool/apply" className="text-red hover:underline">/talent-pool/apply</a> to initiate the parser!</p>
                    ) : (
                      <div className="grid md:grid-cols-3 gap-6">
                        
                        {/* Prompt 0: Resume Parsing */}
                        <div className="bg-[#111114] border border-gray-800 rounded-xl p-4 flex flex-col">
                          <p className="text-red font-bold text-[10px] tracking-wider uppercase mb-2">Stage 0: Resume Vision Parsing</p>
                          <div className="bg-black/50 p-3 rounded border border-gray-900 text-[10px] text-gray-400 mb-3 overflow-y-auto max-h-[140px] flex-1">
                            <span className="text-[#a6e22e] font-bold">Input:</span> {activeSub.resumeFile?.name || "Maria_Resume.pdf"} (Vision base64 PDF Stream)
                            <br/><br/>
                            <span className="text-[#f92672] font-bold">SYSTEM PROMPT:</span>
                            <br/>
                            "You are parsing a professional resume to extract key data... Extract and return ONLY a JSON object: detected_expertise, years_experience, prior_roles, key_skills, red_flags, expertise_mismatch..."
                          </div>
                          <div className="bg-black/60 p-3 rounded border border-gray-900 font-mono text-[10px] text-[#66d9ef]">
                            <p className="text-[#e6db74] font-bold mb-1">Gemini Vision Response JSON:</p>
                            <pre className="overflow-x-auto whitespace-pre">
                              {JSON.stringify(activeSub.parsedResumeData, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* Prompt 1: Assessment Generation */}
                        <div className="bg-[#111114] border border-gray-800 rounded-xl p-4 flex flex-col">
                          <p className="text-red font-bold text-[10px] tracking-wider uppercase mb-2">Stage 1: Custom Task Generation</p>
                          <div className="bg-black/50 p-3 rounded border border-gray-900 text-[10px] text-gray-400 mb-3 overflow-y-auto max-h-[140px] flex-1">
                            <span className="text-[#a6e22e] font-bold">Variables:</span> Detected Expertise: {activeSub.parsedResumeData?.detected_expertise || "Ops Manager"}, Years: {activeSub.parsedResumeData?.years_experience || 7}
                            <br/><br/>
                            <span className="text-[#f92672] font-bold">PROMPT:</span>
                            <br/>
                            "Generate a realistic, 25-minute scenario that tests diagnostic thinking, communication, and process improvement... Return ONLY a JSON object: scenario, deliverable_1, deliverable_2, deliverable_3..."
                          </div>
                          <div className="bg-black/60 p-3 rounded border border-gray-900 font-mono text-[10px] text-[#66d9ef]">
                            <p className="text-[#e6db74] font-bold mb-1">Claude Generation Response JSON:</p>
                            <pre className="overflow-x-auto whitespace-pre max-h-[140px]">
                              {JSON.stringify(activeSub.assessmentTask, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* Prompt 2: Scoring */}
                        <div className="bg-[#111114] border border-gray-800 rounded-xl p-4 flex flex-col">
                          <p className="text-red font-bold text-[10px] tracking-wider uppercase mb-2">Stage 2: Automatic Scoring Rubric</p>
                          <div className="bg-black/50 p-3 rounded border border-gray-900 text-[10px] text-gray-400 mb-3 overflow-y-auto max-h-[140px] flex-1">
                            <span className="text-[#a6e22e] font-bold">Input:</span> Candidate's filled text responses to deliverable 1, 2 and 3.
                            <br/><br/>
                            <span className="text-[#f92672] font-bold">SCORING PROMPT:</span>
                            <br/>
                            "You are scoring a talent assessment response on a 0-100 scale... Rubric: Clarity (0-25), Relevance (0-25), Speed (0-25), Problem-Solving (0-25). Return ONLY a JSON object: total_score, recommendation, summary..."
                          </div>
                          <div className="bg-black/60 p-3 rounded border border-gray-900 font-mono text-[10px] text-[#66d9ef]">
                            <p className="text-[#e6db74] font-bold mb-1">Claude Scoring Response JSON:</p>
                            {activeSub.aiScore ? (
                              <pre className="overflow-x-auto whitespace-pre max-h-[140px]">
                                {JSON.stringify(activeSub.aiScore, null, 2)}
                              </pre>
                            ) : (
                              <p className="text-gray-500 italic py-4 text-center">Waiting for candidate to submit assessment Answers...</p>
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}

                {/* 2. GOOGLE DRIVE TAB */}
                {activeTab === 'drive' && (
                  <div className="space-y-6">
                    <h3 className="text-white font-bold text-sm border-b border-gray-800 pb-2 flex items-center justify-between">
                      <span>Simulated Google Drive API File System Mirror</span>
                      <span className="text-xs text-gray-500 font-normal">Root folder: /BYG Hires Talent Pool/</span>
                    </h3>

                    {driveTree.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <HardDrive size={36} className="mx-auto mb-4 text-gray-600 animate-pulse" />
                        <p>No active Google Drive uploads recorded. Resumes are uploaded on candidate application submit.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {driveTree.map((item, idx) => (
                          <div key={idx} className="bg-[#111114] border border-gray-800 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3 text-white font-bold">
                              <Folder size={16} className="text-yellow-500 fill-yellow-500" />
                              <span>{item.folder}</span>
                              <span className="text-gray-500 font-normal text-[10px] ml-2">(Owner: {item.talentName})</span>
                            </div>
                            <div className="pl-6 space-y-2 border-l border-gray-800">
                              {item.files.map((file, fIdx) => (
                                <div key={fIdx} className="flex items-center justify-between py-1.5 px-3 bg-black/30 rounded border border-gray-900/50">
                                  <div className="flex items-center gap-2 text-gray-400">
                                    <FileText size={14} className="text-red" />
                                    <span>{file.path.split('/').pop()}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                                    <span className="px-2 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded font-black uppercase text-[8px]">{file.status}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. LOCAL STORAGE TAB */}
                {activeTab === 'database' && (
                  <div className="space-y-6">
                    <h3 className="text-white font-bold text-sm border-b border-gray-800 pb-2">
                      LocalStorage Local Database Browser (`byg_submissions`)
                    </h3>
                    <div className="bg-[#111114] border border-gray-800 rounded-xl p-4 overflow-x-auto">
                      <table className="w-full text-left font-mono text-[11px] leading-relaxed">
                        <thead>
                          <tr className="border-b border-gray-800 text-white font-bold">
                            <th className="pb-2 pr-4">ID</th>
                            <th className="pb-2 pr-4">Name</th>
                            <th className="pb-2 pr-4">Email</th>
                            <th className="pb-2 pr-4">Claimed Expertise</th>
                            <th className="pb-2 pr-4">Status</th>
                            <th className="pb-2 pr-4">AI Score</th>
                            <th className="pb-2">Submitted At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map((sub) => (
                            <tr key={sub.id} className="border-b border-gray-800/40 hover:bg-white/2 transition-colors">
                              <td className="py-2.5 pr-4 text-gray-500">{sub.id}</td>
                              <td className="py-2.5 pr-4 font-bold text-white">{sub.name}</td>
                              <td className="py-2.5 pr-4 text-gray-400">{sub.email}</td>
                              <td className="py-2.5 pr-4 text-gray-400">{sub.expertise}</td>
                              <td className="py-2.5 pr-4">
                                <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase border ${
                                  sub.status === 'admitted'
                                    ? 'bg-green-500/10 border-green-500/20 text-green-500'
                                    : sub.status === 'rejected'
                                    ? 'bg-red/10 border-red/20 text-red'
                                    : sub.status === 'pending_human_review'
                                    ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                                    : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                                }`}>
                                  {sub.status}
                                </span>
                              </td>
                              <td className="py-2.5 pr-4 font-bold text-white">{sub.aiScore?.total_score || '--'}/100</td>
                              <td className="py-2.5 text-gray-500">{new Date(sub.submittedAt).toLocaleTimeString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DeveloperConsole;
