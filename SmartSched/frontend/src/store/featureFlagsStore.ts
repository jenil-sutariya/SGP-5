import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

interface FeatureFlagsState {
  flags: Record<FeatureKey, boolean>;
  isLoading: boolean;
  isInitialized: boolean;
  lastUpdated: string | null;
  
  // Actions
  fetchFlags: () => Promise<void>;
  toggleFeature: (key: FeatureKey) => Promise<void>;
  setFeatureState: (key: FeatureKey, enabled: boolean) => Promise<void>;
  applyPreset: (preset: 'all' | 'none' | 'scheduling_only' | 'core_demo') => Promise<void>;
  isFeatureEnabled: (key: FeatureKey) => boolean;
}

export const useFeatureFlagsStore = create<FeatureFlagsState>()(
  persist(
    (set, get) => ({
      flags: DEFAULT_FEATURE_FLAGS,
      isLoading: false,
      isInitialized: false,
      lastUpdated: null,

      fetchFlags: async () => {
        set({ isLoading: true });
        try {
          const res = await api.get('/settings');
          const settingsList: Array<{ key: string; value: any }> = res.data?.data || res.data || [];
          const flagsSetting = settingsList.find((s) => s.key === 'feature_flags');

          if (flagsSetting && flagsSetting.value && typeof flagsSetting.value === 'object') {
            set({
              flags: { ...DEFAULT_FEATURE_FLAGS, ...flagsSetting.value },
              isInitialized: true,
              lastUpdated: new Date().toISOString(),
            });
          } else {
            set({ flags: DEFAULT_FEATURE_FLAGS, isInitialized: true });
          }
        } catch {
          // Fallback to local persisted/default flags if offline
          set({ isInitialized: true });
        } finally {
          set({ isLoading: false });
        }
      },

      toggleFeature: async (key: FeatureKey) => {
        const currentFlags = get().flags;
        const newValue = !currentFlags[key];
        await get().setFeatureState(key, newValue);
      },

      setFeatureState: async (key: FeatureKey, enabled: boolean) => {
        const currentFlags = get().flags;
        const updatedFlags = { ...currentFlags, [key]: enabled };
        
        // Optimistic UI update
        set({ flags: updatedFlags, lastUpdated: new Date().toISOString() });

        try {
          await api.put('/settings/feature_flags', {
            value: updatedFlags,
            category: 'system',
            label: 'Master Admin Feature Flags',
          });
        } catch (err) {
          console.error('Failed to sync feature flags to server', err);
        }
      },

      applyPreset: async (preset) => {
        let newFlags: Record<FeatureKey, boolean>;

        switch (preset) {
          case 'all':
            newFlags = { ...DEFAULT_FEATURE_FLAGS };
            break;
          case 'none':
            newFlags = Object.keys(DEFAULT_FEATURE_FLAGS).reduce((acc, k) => {
              acc[k as FeatureKey] = false;
              return acc;
            }, {} as Record<FeatureKey, boolean>);
            break;
          case 'scheduling_only':
            newFlags = {
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
            break;
          case 'core_demo':
            newFlags = {
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
            break;
          default:
            newFlags = { ...DEFAULT_FEATURE_FLAGS };
        }

        set({ flags: newFlags, lastUpdated: new Date().toISOString() });

        try {
          await api.put('/settings/feature_flags', {
            value: newFlags,
            category: 'system',
            label: 'Master Admin Feature Flags',
          });
        } catch (err) {
          console.error('Failed to sync preset feature flags to server', err);
        }
      },

      isFeatureEnabled: (key: FeatureKey) => {
        const state = get();
        return state.flags[key] ?? true;
      },
    }),
    {
      name: 'smart-sched-feature-flags',
    }
  )
);
