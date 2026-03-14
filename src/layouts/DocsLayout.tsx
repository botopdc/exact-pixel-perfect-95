import React from 'react';
import { Outlet } from 'react-router-dom';
import { DocsSidebar } from '@/components/docs/DocsSidebar';

export default function DocsLayout() {
  return (
    <div className="flex h-[calc(100vh-8rem)] -m-6">
      <DocsSidebar />
      <div className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
