const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = {
  // Talent CRUD
  async createTalent(talent) {
    const { data, error } = await supabase
      .from('talents')
      .insert([talent])
      .single();
    if (error) throw error;
    return data;
  },
  async getTalentById(id) {
    const { data, error } = await supabase
      .from('talents')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
  // Assessment CRUD
  async createAssessment(assessment) {
    const { data, error } = await supabase
      .from('assessments')
      .insert([assessment])
      .single();
    if (error) throw error;
    return data;
  },
  async getAssessmentById(id) {
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },
  // Decision CRUD
  async createDecision(decision) {
    const { data, error } = await supabase
      .from('decisions')
      .insert([decision])
      .single();
    if (error) throw error;
    return data;
  },
  async getPendingAssessments() {
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('status', 'pending');
    if (error) throw error;
    return data;
  }
};
