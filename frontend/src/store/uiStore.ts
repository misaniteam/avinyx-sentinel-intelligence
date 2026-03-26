import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  isOpen: boolean;
  toggleSidebar: () => void;
};

export const useUIStore = create(
  persist<UIState>(
    (set) => ({
      isOpen: false,
      toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })), 
    }),
    {
      name: "ui-store",
    }
  )
);
