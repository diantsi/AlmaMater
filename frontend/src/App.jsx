import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import CreateEventPage from './pages/CreateEventPage.jsx';
import EventsPage from './pages/EventsPage.jsx';

export default function App() {
  return (
    <>
      <header className="app-header">
        <span className="brand">AlmaMater</span>
        <nav className="app-nav">
          {/* `end` keeps "Events" inactive on /events/new */}
          <NavLink to="/events" end>
            Events
          </NavLink>
          <NavLink to="/events/new">Create event</NavLink>
        </nav>
      </header>

      <main className="page">
        <Routes>
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/new" element={<CreateEventPage />} />
          {/* /events is the default destination; event details are not built yet */}
          <Route path="*" element={<Navigate to="/events" replace />} />
        </Routes>
      </main>
    </>
  );
}
