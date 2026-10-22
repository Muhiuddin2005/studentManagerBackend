import { supabase } from '../config/supabase.js';

async function main() {
  if (!supabase) {
    console.log('No supabase client');
    return;
  }
  const tables = [
    'tasks',
    'attachments',
    'timeline_events',
    'task_comments',
    'app_users',
    'email_verification_codes',
    'weekly_routines'
  ];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`❌ Table '${table}': ${error.message}`);
    } else {
      console.log(`✅ Table '${table}': Ready!`);
    }
  }
}

main();
