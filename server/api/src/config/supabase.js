const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL과 SUPABASE_ANON_KEY 환경변수가 필요합니다');
}

// 클라이언트용 (anon key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);

// 서비스용 (service role key)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// 연결 상태 확인
const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('count')
      .limit(1);
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    logger.info('✅ Supabase 연결 성공');
    return true;
  } catch (error) {
    logger.error('❌ Supabase 연결 실패:', error.message);
    return false;
  }
};

module.exports = {
  supabase,
  supabaseAdmin,
  checkSupabaseConnection
};