import { create } from 'zustand'

export const useAppLayoutStore = create((set) => ({
  selectedTab: 'chat',
  selectedItem: null,
  setSelectedTab: (tab) => set({ selectedTab: tab, selectedItem: null }),
  setSelectedItem: (item) => set({ selectedItem: item }),
}))
