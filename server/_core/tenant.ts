import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  userId: number;
  schoolId: number | null;
};

const tenantScope = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(tenant: TenantContext, work: () => T) {
  return tenantScope.run(tenant, work);
}

export function enterTenantContext(tenant: TenantContext) {
  tenantScope.enterWith(tenant);
}

export function getTenantContext() {
  return tenantScope.getStore() ?? null;
}
