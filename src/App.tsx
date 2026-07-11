import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MinePage from './pages/Mine';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex justify-center items-start sm:items-center p-0 sm:p-4">
      {/* Mobile Container Simulation */}
      <div className="w-full max-w-[375px] h-[812px] bg-white shadow-2xl relative overflow-hidden flex flex-col sm:rounded-[40px] sm:border-[8px] sm:border-slate-900">
        <Routes>
          <Route path="/" element={<MinePage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
