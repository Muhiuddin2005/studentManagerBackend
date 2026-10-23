import { Request, Response } from 'express';
import * as routineService from '../services/routineService.js';
import { dispatchDailyRoutineBriefings } from '../services/routineScheduler.js';
import { Role, DayOfWeek } from '../types/index.js';

export async function getRoutines(req: Request, res: Response): Promise<void> {
  try {
    const tuple_id = req.query.tuple_id as string | undefined;
    const routines = await routineService.getAllRoutines(tuple_id);
    res.json({ success: true, count: routines.length, data: routines });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createRoutine(req: Request, res: Response): Promise<void> {
  try {
    const { day, subject, time_slot, topic, note, creator_role, creator_name, tuple_id } = req.body;

    if (!day || !subject) {
      res.status(400).json({
        success: false,
        message: 'Day and subject are required fields.'
      });
      return;
    }

    const validDays: DayOfWeek[] = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (!validDays.includes(day as DayOfWeek)) {
      res.status(400).json({
        success: false,
        message: `Invalid day. Must be one of: ${validDays.join(', ')}`
      });
      return;
    }

    const routine = await routineService.createRoutine({
      tuple_id: tuple_id || null,
      day: day as DayOfWeek,
      subject: subject.trim(),
      time_slot: time_slot || '',
      topic: topic || subject.trim(),
      note: note || '',
      creator_role: (creator_role as Role) || 'student',
      creator_name
    });

    res.status(201).json({ success: true, data: routine });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteRoutine(req: Request, res: Response): Promise<void> {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    
    // Extract role from header, query, or body
    const actorRole = (req.headers['x-actor-role'] as string) || 
                      (req.query.actor_role as string) || 
                      (req.body?.actor_role as string) || 
                      'student';

    if (actorRole !== 'tutor') {
      res.status(403).json({
        success: false,
        message: 'Permission denied: Only teachers/tutors are authorized to delete routine entries.'
      });
      return;
    }

    const result = await routineService.deleteRoutine(id, 'tutor');
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
}

/**
 * Controller endpoint to trigger the morning 6:00 AM daily routine email briefing
 */
export async function triggerDailyRoutineBriefing(req: Request, res: Response): Promise<void> {
  try {
    const { customDay, targetStudentEmail } = req.body || {};
    const day = (customDay || req.query.day) as DayOfWeek | undefined;
    const email = (targetStudentEmail || req.query.targetEmail) as string | undefined;

    const result = await dispatchDailyRoutineBriefings({
      customDay: day,
      targetStudentEmail: email
    });

    res.json({
      success: true,
      message: `Daily morning routine briefing executed for ${result.day}. ${result.emailsSent} email(s) dispatched strictly to student(s).`,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

