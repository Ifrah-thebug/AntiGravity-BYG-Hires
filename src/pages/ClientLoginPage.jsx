import { Navigate } from 'react-router-dom';

/** @deprecated Use /login — kept for old links. */
export default function ClientLoginPage() {
  return <Navigate to="/login" replace />;
}