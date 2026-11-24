import { Navigate, Route, Routes } from 'react-router-dom';

import AuthProvider from './components/AuthProvider.jsx';
import Footer from './components/Footer.jsx';
import MemberHeader from './components/MemberHeader.jsx';
import CreateEventPage from './pages/CreateEventPage.jsx';
import EditEventPage from './pages/EditEventPage.jsx';
import EventDetailsPage from './pages/EventDetailsPage.jsx';
import EventsPage from './pages/EventsPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import OrganisationPage from './pages/OrganisationPage.jsx';
import SignInPage from './pages/SignInPage.jsx';

function MemberApp() {
  return (
    <>
      <MemberHeader />
      <main id="main" className="page">
        <Routes>
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/new" element={<CreateEventPage />} />
          <Route path="/events/:eventId" element={<EventDetailsPage />} />
          <Route path="/events/:eventId/edit" element={<EditEventPage />} />
          <Route path="/organisation" element={<OrganisationPage />} />
          {/* /events is the default destination */}
          <Route path="*" element={<Navigate to="/events" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Anonymous: the landing page shows no event data; signed-out visitors land on /login; the sign-in
          callback redirects failures to /sign-in */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<SignInPage />} />
      <Route path="/sign-in" element={<SignInPage />} />
      <Route
        path="*"
        element={
          <AuthProvider>
            <MemberApp />
          </AuthProvider>
        }
      />
    </Routes>
  );
}
