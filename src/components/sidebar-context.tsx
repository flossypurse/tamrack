"use client";

import { createContext, useContext, useState, useEffect } from "react";

type SidebarState = { expanded: boolean; toggle: () => void };

const SidebarContext = createContext<SidebarState>({
  expanded: false,
  toggle: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-expanded");
    if (saved === "true") setExpanded(true);
  }, []);

  const toggle = () => {
    setExpanded((prev) => {
      localStorage.setItem("sidebar-expanded", String(!prev));
      return !prev;
    });
  };

  return (
    <SidebarContext.Provider value={{ expanded, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}
