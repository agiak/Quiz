import { Navigate, Route, Routes } from 'react-router-dom';
import PlayPage from './play/PlayPage';
import AdminApp from './admin/AdminApp';
import HostPage from './host/HostPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/play" replace />} />
      <Route path="/play" element={<PlayPage />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/host/:gameId" element={<HostPage />} />
      <Route path="*" element={<Navigate to="/play" replace />} />
    </Routes>
  );
}
