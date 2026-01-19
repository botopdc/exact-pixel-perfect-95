import { Navigate } from 'react-router-dom';

// Index now redirects to modular dashboard
const Index = () => {
  return <Navigate to="/modulos/dashboard" replace />;
};

export default Index;
