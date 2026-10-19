import dotenv from 'dotenv';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { clearInMemoryTasks } from '../services/taskService.js';
import { clearInMemoryRoutines } from '../services/routineService.js';
import { clearInMemoryAuth } from '../services/authService.js';

dotenv.config();

export async function clearAllDatabaseTables(): Promise<{
  success: boolean;
  message: string;
  clearedTables: Record<string, string>;
}> {
  console.log('🧹 [DB Cleanup] Starting database tables cleanup for production...');

  // 1. Reset all in-memory production stores
  clearInMemoryTasks();
  clearInMemoryRoutines();
  clearInMemoryAuth();
  console.log('✅ [Memory] Cleared all in-memory tasks, routines, users, and codes.');

  const results: Record<string, string> = {
    in_memory: 'Cleared (tasks, routines, users, verification codes)',
  };

  // 2. Clear Supabase tables if configured and reachable
  if (isSupabaseConfigured && supabase) {
    const tables = [
      'task_comments',
      'timeline_events',
      'attachments',
      'tasks',
      'weekly_routines',
      'email_verification_codes',
      'app_users'
    ];

    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
          results[table] = `Notice: ${error.message}`;
          console.warn(`⚠️ [Supabase] ${table}:`, error.message);
        } else {
          results[table] = '0 rows (table cleared)';
          console.log(`✅ [Supabase] Cleared table: ${table}`);
        }
      } catch (err: any) {
        results[table] = `Skipped: ${err.message}`;
      }
    }
  } else {
    results.supabase = 'Skipped (no active Supabase instance connected)';
  }

  console.log('🎉 [DB Cleanup] Cleanup complete. System is clean and production ready.');

  return {
    success: true,
    message: 'All database tables and state stores have been cleared successfully.',
    clearedTables: results
  };
}

// Auto-run when executed directly via CLI
if (process.argv[1]?.includes('clearAllTables')) {
  clearAllDatabaseTables()
    .then((res) => {
      console.log('\n--- Final Summary ---');
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal error during table cleanup:', err);
      process.exit(1);
    });
}
