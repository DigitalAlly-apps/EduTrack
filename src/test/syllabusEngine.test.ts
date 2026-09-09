import { describe, it, expect } from 'vitest';
import {
  suggestExamPeriodDistribution
} from '@/lib/syllabusEngine';
import { Material } from '@/lib/types';

describe('syllabusEngine', () => {
  describe('suggestExamPeriodDistribution', () => {
    it('returns empty array for empty materials', () => {
      expect(suggestExamPeriodDistribution([])).toEqual([]);
    });

    it('suggests SMT 1 UTS for single material', () => {
      const mats: Material[] = [
        { id: '1', subjectId: 's1', classId: 'c1', name: 'Bab 1', sessions: 2, order: 1 }
      ];
      const res = suggestExamPeriodDistribution(mats);
      expect(res).toHaveLength(1);
      expect(res[0].suggestedSemester).toBe(1);
      expect(res[0].suggestedPeriod).toBe('UTS');
    });

    it('splits 4 materials across SMT 1 (UTS/UAS) and SMT 2 (UTS/UAS)', () => {
      const mats: Material[] = [
        { id: '1', subjectId: 's1', classId: 'c1', name: 'Bab 1', sessions: 2, order: 1 },
        { id: '2', subjectId: 's1', classId: 'c1', name: 'Bab 2', sessions: 2, order: 2 },
        { id: '3', subjectId: 's1', classId: 'c1', name: 'Bab 3', sessions: 2, order: 3 },
        { id: '4', subjectId: 's1', classId: 'c1', name: 'Bab 4', sessions: 2, order: 4 },
      ];
      const res = suggestExamPeriodDistribution(mats);
      expect(res).toHaveLength(4);

      // Bab 1: SMT 1 UTS
      expect(res[0].suggestedSemester).toBe(1);
      expect(res[0].suggestedPeriod).toBe('UTS');

      // Bab 2: SMT 1 UAS
      expect(res[1].suggestedSemester).toBe(1);
      expect(res[1].suggestedPeriod).toBe('UAS');

      // Bab 3: SMT 2 UTS
      expect(res[2].suggestedSemester).toBe(2);
      expect(res[2].suggestedPeriod).toBe('UTS');

      // Bab 4: SMT 2 UAS
      expect(res[3].suggestedSemester).toBe(2);
      expect(res[3].suggestedPeriod).toBe('UAS');
    });
  });
});
