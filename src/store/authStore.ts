import { create } from 'zustand';

type User = {
  id: string;
  email: string;
} | null;

type AuthStore = {
  user: User;

  setUser: (user: User) => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,

  setUser: (user) => set({ user }),
}));