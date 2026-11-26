import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';

export type FeatureKey =
  | 'institutes'
  | 'departments'
  | 'batches'
  | 'sections'
  | 'faculty'
  | 'students'
  | 'courses'
  | 'subjects'
  | 'rooms'
  | 'labs'
  | 'timetable'
  | 'scheduler'
  | 'notifications';

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  category: 'organisation' | 'people' | 'academics' | 'facilities' | 'scheduling';
  description: string;
  route: string;
  iconName: string;
}

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: 'institutes',
    label: 'Institutes',
    category: 'organisation',
    description: 'Institute structural overview, codes, and top-level admin management.',
    route: '/institutes',
    iconName: 'Building2',
  },
  {
    key: 'departments',
    label: 'Departments',
    category: 'organisation',
    description: 'Departmental management, codes, and building allocations.',
    route: '/departments',
    iconName: 'Building',
  },
  {
    key: 'batches',
    label: 'Batches / Classes',
    category: 'academics',
    description: 'Student batch year levels, capacity, and semester management.',
    route: '/batches',
    iconName: 'GraduationCap',
  },
  {
    key: 'sections',
    label: 'Sections & Batches',
    category: 'academics',
    description: 'Class divisions and practical lab subgroup allocations.',
    route: '/sections',
    iconName: 'Users',
  },
  {
    key: 'faculty',
    label: 'Professors',
    category: 'people',
    description: 'Faculty profiles, workload limits, availability, and preferences.',
    route: '/faculty',
    iconName: 'UserCheck',
  },
  {
    key: 'students',
    label: 'Students',
    category: 'people',
    description: 'Student directory, enrollment numbers, and section assignments.',
    route: '/students',
    iconName: 'User',
  },
  {
    key: 'courses',
    label: 'Courses',
    category: 'academics',
    description: 'Degree programs, credit requirements, and degree structures.',
    route: '/courses',
    iconName: 'BookOpen',
  },
  {
    key: 'subjects',
    label: 'Subjects',
    category: 'academics',
    description: 'Theory and practical subjects, credits, and weekly hours.',
    route: '/subjects',
    iconName: 'BookMarked',
  },
  {
    key: 'rooms',
    label: 'Classrooms',
    category: 'facilities',
    description: 'Lecture halls, classroom capacities, AC, and projector specs.',
    route: '/rooms',
    iconName: 'DoorOpen',
  },
  {
    key: 'labs',
    label: 'Laboratories',
    category: 'facilities',
    description: 'Computer and hardware lab facilities and equipment capabilities.',
    route: '/labs',
    iconName: 'FlaskConical',
  },
  {
    key: 'timetable',
    label: 'My Timetable',
    category: 'scheduling',
    description: 'Interactive weekly timetable grid, view modes, and export options.',
    route: '/timetable',
    iconName: 'CalendarDays',
  },
  {
    key: 'scheduler',
    label: 'Generate AI',
    category: 'scheduling',
    description: 'Constraint-based AI automated timetable generator engine.',
    route: '/scheduler',
    iconName: 'Cpu',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    category: 'scheduling',
    description: 'In-app real-time notification alerts and system announcements.',
    route: '/notifications',
    iconName: 'Bell',
  },
];

export const DEFAULT_FEATURE_FLAGS: Record<FeatureKey, boolean> = {
  institutes: true,
  departments: true,
  batches: true,
  sections: true,
  faculty: true,
  students: true,
  courses: true,
  subjects: true,
  rooms: true,
  labs: true,
  timetable: true,
  scheduler: true,
  notifications: true,
};

export type FeaturePreset = 'all' | 'none' | 'scheduling_only' | 'core_demo';

interface FeatureFlagsState {
  flags: Record<FeatureKey, boolean>;
  isInitialized: boolean;
  lastUpdated: string | null;
  setFlags: (flags: Record<FeatureKey, boolean>, lastUpdated?: string) => void;
  markInitialized: () => void;
  isFeatureEnabled: (key: FeatureKey) => boolean;
}

export function getPresetFlags(preset: FeaturePreset): Record<FeatureKey, boolean> {
  switch (preset) {
    case 'none':
      return Object.keys(DEFAULT_FEATURE_FLAGS).reduce((acc, k) => {
        acc[k as FeatureKey] = false;
        return acc;
      }, {} as Record<FeatureKey, boolean>);
    case 'scheduling_only':
      return {
        institutes: false,
        departments: true,
        batches: false,
        sections: true,
        faculty: true,
        students: false,
        courses: false,
        subjects: true,
        rooms: true,
        labs: true,
        timetable: true,
        scheduler: true,
        notifications: true,
      };
    case 'core_demo':
    case 'all':
    default:
      return { ...DEFAULT_FEATURE_FLAGS };
  }
}

export const useFeatureFlagsStore = create<FeatureFlagsState>()(
  persist(
    (set, get) => ({
      flags: DEFAULT_FEATURE_FLAGS,
      isInitialized: false,
      lastUpdated: null,
      setFlags: (flags, lastUpdated = new Date().toISOString()) =>
        set({ flags, isInitialized: true, lastUpdated }),
      markInitialized: () => set({ isInitialized: true }),
      isFeatureEnabled: (key: FeatureKey) => get().flags[key] ?? true,
    }),
    {
      name: 'smart-sched-feature-flags',
    }
  )
);

export function useFeatureFlagsQuery(enabled = true) {
  const setFlags = useFeatureFlagsStore((s) => s.setFlags);
  const markInitialized = useFeatureFlagsStore((s) => s.markInitialized);

  const query = useQuery({
    queryKey: ['feature-flags'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get('/settings');
      const settingsList: Array<{ key: string; value: unknown }> = res.data?.data || res.data || [];
      const flagsSetting = settingsList.find((s) => s.key === 'feature_flags');
      if (flagsSetting?.value && typeof flagsSetting.value === 'object') {
        return {
          ...DEFAULT_FEATURE_FLAGS,
          ...(flagsSetting.value as Partial<Record<FeatureKey, boolean>>),
        };
      }
      return { ...DEFAULT_FEATURE_FLAGS };
    },
  });

  useEffect(() => {
    if (query.data) {
      setFlags(query.data);
    } else if (query.isError) {
      markInitialized();
    }
  }, [query.data, query.isError, setFlags, markInitialized]);

  return query;
}

export function useSaveFeatureFlagsMutation() {
  const qc = useQueryClient();
  const setFlags = useFeatureFlagsStore((s) => s.setFlags);

  return useMutation({
    mutationFn: async (updatedFlags: Record<FeatureKey, boolean>) => {
      await api.put('/settings/feature_flags', {
        value: updatedFlags,
        category: 'system',
        label: 'Master Admin Feature Flags',
      });
      return updatedFlags;
    },
    onMutate: (updatedFlags) => {
      const previous = useFeatureFlagsStore.getState().flags;
      setFlags(updatedFlags);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) setFlags(context.previous);
    },
    onSuccess: (updatedFlags) => {
      qc.setQueryData(['feature-flags'], updatedFlags);
    },
  });
}
