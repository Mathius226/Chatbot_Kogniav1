import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Chat } from './components/Chat';
import { Admin } from './components/Admin';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;