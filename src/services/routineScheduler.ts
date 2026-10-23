import cron, { ScheduledTask } from 'node-cron';
import { getAllAcceptedTuples } from './tupleService.js';
import { getAllRoutines } from './routineService.js';
import { sendDailyRoutineEmail } from './emailService.js';
import { DayOfWeek } from '../types/index.js';

export interface DispatchResult {
  success: boolean;
  timestamp: string;
  day: DayOfWeek;
  dateStr: string;
  totalStudentsProcessed: number;
  emailsSent: number;
  results: {
    studentEmail: string;
    studentName: string;
    routinesCount: number;
    success: boolean;
  }[];
}

/**
 * Dispatches daily morning routine email briefings strictly to students.
 * Tutors are not sent this daily morning briefing.
 */
export async function dispatchDailyRoutineBriefings(options?: {
  customDay?: DayOfWeek;
  targetStudentEmail?: string;
}): Promise<DispatchResult> {
  const timezone = process.env.TIMEZONE || 'Asia/Dhaka';
  const now = new Date();

  // Determine day of the week in configured timezone
  const day = (options?.customDay || new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: timezone
  }).format(now)) as DayOfWeek;

  const dateStr = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone
  }).format(now);

  console.log(`⏰ [Routine Scheduler] Starting morning briefing dispatch for ${day}, ${dateStr} (Timezone: ${timezone})...`);

  // 1. Fetch all accepted tuples
  const acceptedTuples = await getAllAcceptedTuples();

  // 2. Identify all target students
  // Group by student email so a student with multiple tutors (or single tutor) receives their unified schedule
  const studentMap = new Map<string, {
    studentName: string;
    tupleIds: string[];
    tutorNames: string[];
  }>();

  for (const pair of acceptedTuples) {
    const sEmail = pair.student_email.trim().toLowerCase();
    if (!studentMap.has(sEmail)) {
      studentMap.set(sEmail, {
        studentName: pair.student_name,
        tupleIds: [pair.id],
        tutorNames: [pair.tutor_name]
      });
    } else {
      const existing = studentMap.get(sEmail)!;
      if (!existing.tupleIds.includes(pair.id)) existing.tupleIds.push(pair.id);
      if (!existing.tutorNames.includes(pair.tutor_name)) existing.tutorNames.push(pair.tutor_name);
    }
  }

  // Also include student test email if passed in targetStudentEmail and not already in map
  if (options?.targetStudentEmail) {
    const testEmail = options.targetStudentEmail.trim().toLowerCase();
    if (!studentMap.has(testEmail)) {
      studentMap.set(testEmail, {
        studentName: 'Student',
        tupleIds: [],
        tutorNames: []
      });
    }
  }

  const results: DispatchResult['results'] = [];
  let sentCount = 0;

  for (const [studentEmail, studentInfo] of studentMap.entries()) {
    // If target email filter provided, skip other students
    if (options?.targetStudentEmail && studentEmail !== options.targetStudentEmail.trim().toLowerCase()) {
      continue;
    }

    try {
      // Fetch routines for this student across their tuple(s)
      let allStudentRoutines = [];
      if (studentInfo.tupleIds.length > 0) {
        for (const tupleId of studentInfo.tupleIds) {
          const routines = await getAllRoutines(tupleId);
          allStudentRoutines.push(...routines);
        }
      } else {
        // Fallback: unassigned routines
        const unassigned = await getAllRoutines();
        allStudentRoutines = unassigned;
      }

      // Filter routines specifically for today!
      const todaysRoutines = allStudentRoutines.filter(r => r.day === day);

      // CRITICAL REQUIREMENT: Send email ONLY to the student!
      const sent = await sendDailyRoutineEmail({
        studentEmail,
        studentName: studentInfo.studentName,
        day,
        dateStr,
        routines: todaysRoutines,
        tutorName: studentInfo.tutorNames.join(', ') || undefined
      });

      if (sent) sentCount++;

      results.push({
        studentEmail,
        studentName: studentInfo.studentName,
        routinesCount: todaysRoutines.length,
        success: sent
      });
    } catch (err: any) {
      console.error(`⚠️ [Routine Scheduler] Error processing student ${studentEmail}:`, err.message);
      results.push({
        studentEmail,
        studentName: studentInfo.studentName,
        routinesCount: 0,
        success: false
      });
    }
  }

  console.log(`✅ [Routine Scheduler] Morning briefing finished: ${sentCount} of ${results.length} students emailed.`);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    day,
    dateStr,
    totalStudentsProcessed: results.length,
    emailsSent: sentCount,
    results
  };
}

let scheduledJob: ScheduledTask | null = null;

/**
 * Initializes the automated daily 6:00 AM cron schedule
 */
export function initRoutineScheduler(): void {
  // Default: '0 6 * * *' (6:00 AM every day)
  const cronExpression = process.env.CRON_SCHEDULE_DAILY_ROUTINE || '0 6 * * *';
  const timezone = process.env.TIMEZONE || 'Asia/Dhaka';

  if (scheduledJob) {
    scheduledJob.stop();
  }

  scheduledJob = cron.schedule(
    cronExpression,
    async () => {
      console.log(`⏰ [Cron Trigger] 6:00 AM Daily Student Routine Briefing firing for timezone: ${timezone}`);
      try {
        await dispatchDailyRoutineBriefings();
      } catch (err: any) {
        console.error('⚠️ [Cron Error] Failed to execute daily routine job:', err.message);
      }
    },
    {
      timezone
    }
  );

  console.log(`⏰ [Routine Scheduler] Initialized daily cron job: "${cronExpression}" (Timezone: ${timezone})`);
}
