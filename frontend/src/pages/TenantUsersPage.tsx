import { Navigate, useParams } from 'react-router-dom';

export default function TenantUsersPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  return <Navigate to={`/tenants/${tenantId}/settings/users`} replace />;
}
