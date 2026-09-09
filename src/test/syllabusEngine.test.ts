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

    it('suggests UTS for single material', () => {
      const mats: Material[] = [
        { id: '1', subjectId: 's1', classId: 'c1', name: 'Bab 1', sessions: 2, order: 1 }
      ];
      const res = suggestExamPeriodDistribution(mats);
      expect(res).toHaveLength(1);
      expect(res[0].suggestedPeriod).toBe('UTS');
    });

    it('splits multiple materials evenly between UTS and UAS based on session count', () => {
      const mats: Material[] = [
        { id: '1', subjectId: 's1', classId: 'c1', name: 'Bab 1', sessions: 2, order: 1 },
        { id: '2', subjectId: 's1', classId: 'c1', name: 'Bab 2', sessions: 2, order: 2 },
        { id: '3', subjectId: 's1', classId: 'c1', name: 'Bab 3', sessions: 2, order: 3 },
        { id: '4', subjectId: 's1', classId: 'c1', name: 'Bab 4', sessions: 2, order: 4 },
      ];
      const res = suggestExamPeriodDistribution(mats);
      expect(res).toHaveLength(4);
      expect(res[0].suggestedPeriod).toBe('UTS');
      expect(res[1].suggestedPeriod).toBe('UTS');
      expect(res[2].suggestedPeriod).toBe('UAS');
      expect(res[3].suggestedPeriod).toBe('UAS');
    });
  });
});
