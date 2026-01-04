import { Navigate } from 'react-router-dom';

// Index now redirects to dashboard
const Index = () => {
  return <Navigate to="/dashboard" replace />;
};

export default Index;
