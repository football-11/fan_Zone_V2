/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HostPage } from './pages/HostPage';
import { StudioPage } from './pages/StudioPage';
import { ContentPage } from './pages/ContentPage';
import { CustomizePage } from './pages/CustomizePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/host" element={<HostPage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/content" element={<ContentPage />} />
        <Route path="/customize" element={<CustomizePage />} />
        <Route path="*" element={<Navigate to="/host" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
