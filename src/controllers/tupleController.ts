import { Request, Response } from 'express';
import * as tupleService from '../services/tupleService.js';
import { Role } from '../types/index.js';

export async function getTeachers(req: Request, res: Response): Promise<void> {
  try {
    const studentEmail = (req.query.studentEmail as string) || (req.headers['x-user-email'] as string);
    const teachers = await tupleService.getAvailableTeachers(studentEmail);
    res.json({
      success: true,
      count: teachers.length,
      data: teachers
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getMyTuples(req: Request, res: Response): Promise<void> {
  try {
    const email = (req.query.email as string) || (req.headers['x-user-email'] as string);
    const role = ((req.query.role as string) || (req.headers['x-user-role'] as string) || 'student') as Role;

    if (!email) {
      res.status(400).json({ success: false, message: 'User email is required' });
      return;
    }

    const result = await tupleService.getMyTuples(email, role);
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function requestConnection(req: Request, res: Response): Promise<void> {
  try {
    const { tutor_email, tutor_name, tutor_id, student_email, student_name, student_id } = req.body;

    if (!tutor_email || !student_email) {
      res.status(400).json({
        success: false,
        message: 'Both tutor_email and student_email are required.'
      });
      return;
    }

    const pair = await tupleService.requestConnection({
      tutor_email,
      tutor_name,
      tutor_id,
      student_email,
      student_name,
      student_id
    });

    res.status(201).json({
      success: true,
      message: 'Connection request sent to teacher successfully.',
      data: pair
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function respondToRequest(req: Request, res: Response): Promise<void> {
  try {
    const { tuple_id, status } = req.body;

    if (!tuple_id || !status || !['accepted', 'rejected'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'tuple_id and status ("accepted" | "rejected") are required.'
      });
      return;
    }

    const pair = await tupleService.respondToRequest({
      tuple_id,
      status
    });

    res.json({
      success: true,
      message: `Connection request ${status} successfully.`,
      data: pair
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
