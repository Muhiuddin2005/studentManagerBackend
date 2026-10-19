import { Request, Response } from 'express';
import * as routineService from '../services/routineService.js';
import { Role, DayOfWeek } from '../types/index.js';

export async function getRoutines(_req: Request, res: Response): Promise<void> {
  try {
    const routines = await routineService.getAllRoutines();
    res.json({ success: true, count: routines.length, data: routines });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createRoutine(req: Request, res: Response): Promise<void> {
  try {
    const { day, subject, time_slot, topic, note, creator_role, creator_name } = req.body;

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
